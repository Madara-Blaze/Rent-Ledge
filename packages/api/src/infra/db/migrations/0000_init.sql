-- ============================================================================
-- RentLedger — financial-core schema (Phase 3 slice)
--
-- Design notes:
--  * The ledger (journal_entries + ledger_postings) is the SOURCE OF TRUTH and is
--    APPEND-ONLY: a trigger blocks UPDATE/DELETE. Corrections are made by posting
--    a REVERSAL entry, never by mutation.
--  * A deferred constraint trigger guarantees every entry is balanced
--    (Σdebits == Σcredits) and that postings reconcile to journal_entries.total_minor,
--    so even a buggy caller cannot persist an unbalanced entry.
--  * All money is BIGINT minor units (paise). No floats anywhere.
--  * Balances are never stored — they are computed from postings on demand.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- --- shared append-only guard -----------------------------------------------
CREATE OR REPLACE FUNCTION rl_prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted (use a reversing entry)',
    TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Minimal entities required to anchor money (full property/tenancy modelling
-- lands in Phase 1; this is the "just enough scaffolding to run" surface).
-- ============================================================================

CREATE TABLE landlords (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text,
  -- PAN is PII: stored encrypted by the app (AES-GCM). pan_valid drives TDS rate.
  pan_encrypted text,
  pan_valid     boolean NOT NULL DEFAULT false,
  jurisdiction  text NOT NULL DEFAULT 'IN',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text,
  phone       text,
  payer_class text NOT NULL DEFAULT 'INDIVIDUAL_HUF'
                CHECK (payer_class IN ('INDIVIDUAL_HUF','COMPANY_FIRM_AUDITED','OTHER')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE properties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id  uuid NOT NULL REFERENCES landlords(id),
  name         text NOT NULL,
  address      text,
  type         text NOT NULL DEFAULT 'RESIDENTIAL'
                 CHECK (type IN ('RESIDENTIAL','COMMERCIAL','PG','CO_LIVING')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  label       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenancies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id       uuid NOT NULL REFERENCES landlords(id),
  property_id       uuid NOT NULL REFERENCES properties(id),
  unit_id           uuid REFERENCES units(id),
  primary_tenant_id uuid NOT NULL REFERENCES tenants(id),
  currency          text NOT NULL DEFAULT 'INR',
  jurisdiction      text NOT NULL DEFAULT 'IN',
  rent_minor        bigint NOT NULL CHECK (rent_minor >= 0),
  deposit_minor     bigint NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0),
  billing_day       int NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  start_date        date NOT NULL,
  end_date          date,
  escalation        jsonb,   -- EscalationSchedule (nullable)
  status            text NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('DRAFT','AGREEMENT_PENDING','ACTIVE','NOTICE_PERIOD',
                                        'ENDED','RENEWED','TERMINATED','EVICTED')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tenancies_landlord ON tenancies(landlord_id);

-- ============================================================================
-- Jurisdiction policy store (versioned, effective-dated). The whole policy body
-- is JSONB so new jurisdictions are pure data; effective_from/to drive lookup.
-- ============================================================================
CREATE TABLE jurisdiction_policies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction       text NOT NULL,
  version            int NOT NULL,
  effective_from     date NOT NULL,
  effective_to       date,
  reviewed_by_counsel boolean NOT NULL DEFAULT false,
  body               jsonb NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, version)
);
CREATE INDEX ix_policies_lookup ON jurisdiction_policies(jurisdiction, effective_from);

-- ============================================================================
-- Double-entry ledger
-- ============================================================================
CREATE TABLE ledger_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id  uuid NOT NULL REFERENCES landlords(id),
  tenancy_id   uuid REFERENCES tenancies(id),
  property_id  uuid REFERENCES properties(id),
  code         text NOT NULL,
  type         text NOT NULL CHECK (type IN ('ASSET','LIABILITY','INCOME','EXPENSE','EQUITY')),
  currency     text NOT NULL DEFAULT 'INR',
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- One account per (landlord, code, tenancy, property). COALESCE so NULL scopes
-- still de-duplicate (NULLs are otherwise distinct in a unique index).
CREATE UNIQUE INDEX ux_ledger_accounts_scope ON ledger_accounts (
  landlord_id, code,
  COALESCE(tenancy_id,  '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE TABLE journal_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id     uuid NOT NULL REFERENCES landlords(id),
  tenancy_id      uuid REFERENCES tenancies(id),
  entry_type      text NOT NULL,
  occurred_at     timestamptz NOT NULL,          -- business/effective date
  recorded_at     timestamptz NOT NULL DEFAULT now(), -- system write time
  currency        text NOT NULL DEFAULT 'INR',
  description     text,
  source_type     text,
  source_id       uuid,
  idempotency_key text UNIQUE,                    -- dedup retries/duplicate webhooks
  reversal_of     uuid REFERENCES journal_entries(id),
  created_by      uuid,
  total_minor     bigint NOT NULL CHECK (total_minor >= 0)
);
CREATE INDEX ix_journal_landlord ON journal_entries(landlord_id);
CREATE INDEX ix_journal_tenancy ON journal_entries(tenancy_id);
CREATE INDEX ix_journal_source ON journal_entries(source_type, source_id);

CREATE TABLE ledger_postings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id),
  account_id       uuid NOT NULL REFERENCES ledger_accounts(id),
  side             text NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
  amount_minor     bigint NOT NULL CHECK (amount_minor > 0),
  currency         text NOT NULL DEFAULT 'INR',
  memo             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_postings_entry ON ledger_postings(journal_entry_id);
CREATE INDEX ix_postings_account ON ledger_postings(account_id);

-- Append-only: block UPDATE/DELETE on the ledger.
CREATE TRIGGER trg_journal_entries_append_only
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
CREATE TRIGGER trg_ledger_postings_append_only
  BEFORE UPDATE OR DELETE ON ledger_postings
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();

-- Balanced-entry guarantee, checked at COMMIT (deferred) so multi-row inserts
-- within one transaction are validated as a whole.
CREATE OR REPLACE FUNCTION rl_assert_entry_balanced() RETURNS trigger AS $$
DECLARE
  v_debit  bigint;
  v_credit bigint;
  v_total  bigint;
BEGIN
  SELECT
    COALESCE(SUM(amount_minor) FILTER (WHERE side = 'DEBIT'), 0),
    COALESCE(SUM(amount_minor) FILTER (WHERE side = 'CREDIT'), 0)
  INTO v_debit, v_credit
  FROM ledger_postings
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Unbalanced journal entry %: debit=% credit=%',
      NEW.journal_entry_id, v_debit, v_credit;
  END IF;

  SELECT total_minor INTO v_total FROM journal_entries WHERE id = NEW.journal_entry_id;
  IF v_total IS DISTINCT FROM v_debit THEN
    RAISE EXCEPTION 'Journal entry % total_minor=% does not match postings sum=%',
      NEW.journal_entry_id, v_total, v_debit;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_ledger_postings_balanced
  AFTER INSERT ON ledger_postings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION rl_assert_entry_balanced();

-- ============================================================================
-- Invoices / payments / allocations / deposits.
-- Financial truth lives in the ledger; these rows are queryable convenience that
-- always carry the journal_entry_id that recorded them.
-- ============================================================================
CREATE TABLE invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id      uuid NOT NULL REFERENCES landlords(id),
  tenancy_id       uuid NOT NULL REFERENCES tenancies(id),
  number           text NOT NULL,
  kind             text NOT NULL DEFAULT 'RENT'
                     CHECK (kind IN ('RENT','LATE_FEE','ADJUSTMENT','OTHER')),
  period_start     date,
  period_end       date,
  due_date         date NOT NULL,
  currency         text NOT NULL DEFAULT 'INR',
  amount_minor     bigint NOT NULL CHECK (amount_minor >= 0),
  status           text NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','PARTIALLY_PAID','PAID','VOID','WRITTEN_OFF')),
  journal_entry_id uuid REFERENCES journal_entries(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landlord_id, number)
);
CREATE INDEX ix_invoices_tenancy ON invoices(tenancy_id);

CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id        uuid NOT NULL REFERENCES landlords(id),
  tenancy_id         uuid NOT NULL REFERENCES tenancies(id),
  method             text NOT NULL
                       CHECK (method IN ('UPI','CARD','NETBANKING','CASH','CHEQUE','BANK_TRANSFER','ADJUSTMENT')),
  amount_minor       bigint NOT NULL CHECK (amount_minor > 0),
  tds_minor          bigint NOT NULL DEFAULT 0 CHECK (tds_minor >= 0),
  currency           text NOT NULL DEFAULT 'INR',
  status             text NOT NULL DEFAULT 'SUCCEEDED'
                       CHECK (status IN ('PENDING','SUCCEEDED','FAILED','REFUNDED')),
  reference          text,
  gateway            text,
  gateway_payment_id text,
  idempotency_key    text UNIQUE,
  received_at        timestamptz NOT NULL DEFAULT now(),
  journal_entry_id   uuid REFERENCES journal_entries(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_payments_tenancy ON payments(tenancy_id);

CREATE TABLE payment_allocations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid NOT NULL REFERENCES payments(id),
  invoice_id   uuid NOT NULL REFERENCES invoices(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX ix_alloc_invoice ON payment_allocations(invoice_id);

CREATE TABLE deposit_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id  uuid NOT NULL REFERENCES landlords(id),
  tenancy_id   uuid NOT NULL UNIQUE REFERENCES tenancies(id),
  currency     text NOT NULL DEFAULT 'INR',
  target_minor bigint NOT NULL DEFAULT 0 CHECK (target_minor >= 0),
  status       text NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','HELD','PARTIALLY_REFUNDED','REFUNDED','FORFEITED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE deposit_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_account_id uuid NOT NULL REFERENCES deposit_accounts(id),
  type               text NOT NULL CHECK (type IN ('COLLECTION','DEDUCTION','REFUND','INTEREST')),
  amount_minor       bigint NOT NULL CHECK (amount_minor > 0),
  reason             text,
  evidence_ref       text, -- pointer to an evidence/inspection record (Phase 5)
  journal_entry_id   uuid REFERENCES journal_entries(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_deposit_tx_account ON deposit_transactions(deposit_account_id);

-- Deposit movements are evidence-grade: append-only.
CREATE TRIGGER trg_deposit_transactions_append_only
  BEFORE UPDATE OR DELETE ON deposit_transactions
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();

-- ============================================================================
-- HTTP-level idempotency for money-moving / notice-sending endpoints.
-- ============================================================================
CREATE TABLE idempotency_keys (
  key          text PRIMARY KEY,
  scope        text NOT NULL,
  request_hash text NOT NULL,
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
