-- ============================================================================
-- RentLedger — Phase 5: maintenance, evidence vault, notices, house rules, notifications.
--   * evidence_entries are a hash-chained, append-only tamper-evident log.
--   * ticket_events, delivery_receipts, acknowledgements, notification_log are append-only.
-- ============================================================================

CREATE TABLE vendors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id),
  name        text NOT NULL,
  contact     text,
  category    text,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_vendors_landlord ON vendors(landlord_id);

CREATE TABLE maintenance_tickets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id              uuid NOT NULL REFERENCES landlords(id),
  tenancy_id               uuid REFERENCES tenancies(id),
  property_id              uuid REFERENCES properties(id),
  title                    text NOT NULL,
  description              text,
  category                 text,
  priority                 text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  status                   text NOT NULL DEFAULT 'OPEN'
                             CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED')),
  assigned_vendor_id       uuid REFERENCES vendors(id),
  cost_minor               bigint NOT NULL DEFAULT 0 CHECK (cost_minor >= 0),
  cost_bearer              text NOT NULL DEFAULT 'LANDLORD' CHECK (cost_bearer IN ('LANDLORD','TENANT','SPLIT')),
  chargeback_journal_entry_id uuid REFERENCES journal_entries(id),
  sla_due                  timestamptz,
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tickets_landlord ON maintenance_tickets(landlord_id);
CREATE INDEX ix_tickets_tenancy ON maintenance_tickets(tenancy_id);

CREATE TABLE ticket_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES maintenance_tickets(id),
  type          text NOT NULL,
  note          text,
  evidence_ref  text,
  actor_user_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ticket_events_ticket ON ticket_events(ticket_id);

CREATE TABLE dispute_cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id      uuid NOT NULL REFERENCES landlords(id),
  tenancy_id       uuid REFERENCES tenancies(id),
  title            text NOT NULL,
  status           text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ESCALATED','RESOLVED','CLOSED')),
  resolution_notes text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_disputes_landlord ON dispute_cases(landlord_id);

-- Hash-chained, append-only evidence log (one chain per landlord workspace).
CREATE TABLE evidence_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id     uuid NOT NULL REFERENCES landlords(id),
  dispute_case_id uuid REFERENCES dispute_cases(id),
  tenancy_id      uuid REFERENCES tenancies(id),
  seq             bigint NOT NULL,
  author_user_id  uuid,
  entry_type      text NOT NULL,
  summary         text NOT NULL,
  content         jsonb,
  content_hash    text NOT NULL,
  prev_hash       text NOT NULL,
  entry_hash      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landlord_id, seq)
);
CREATE INDEX ix_evidence_landlord ON evidence_entries(landlord_id);
CREATE INDEX ix_evidence_dispute ON evidence_entries(dispute_case_id);

CREATE TABLE notices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id       uuid NOT NULL REFERENCES landlords(id),
  tenancy_id        uuid NOT NULL REFERENCES tenancies(id),
  type              text NOT NULL,
  subject           text NOT NULL,
  body              text NOT NULL,
  effective_date    date,
  min_notice_days   int NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT')),
  evidence_entry_id uuid REFERENCES evidence_entries(id),
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notices_tenancy ON notices(tenancy_id);

CREATE TABLE delivery_receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id   uuid NOT NULL REFERENCES notices(id),
  channel     text NOT NULL,
  status      text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT','DELIVERED','READ','FAILED')),
  provider_ref text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_delivery_notice ON delivery_receipts(notice_id);

CREATE TABLE house_rules_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id),
  property_id uuid REFERENCES properties(id),
  version     int NOT NULL,
  body        text NOT NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_house_rules_property ON house_rules_versions(property_id);

CREATE TABLE house_rules_acknowledgements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_rules_version_id uuid NOT NULL REFERENCES house_rules_versions(id),
  tenancy_id            uuid REFERENCES tenancies(id),
  user_id               uuid,
  acknowledged_at       timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_hr_ack_version ON house_rules_acknowledgements(house_rules_version_id);

CREATE TABLE notification_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id  uuid,
  channel      text NOT NULL,
  recipient    text NOT NULL,
  template     text,
  payload      jsonb,
  status       text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT','FAILED')),
  provider_ref text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notification_landlord ON notification_log(landlord_id);

-- Append-only guards for the evidence-grade tables.
CREATE TRIGGER trg_ticket_events_append_only BEFORE UPDATE OR DELETE ON ticket_events
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
CREATE TRIGGER trg_evidence_entries_append_only BEFORE UPDATE OR DELETE ON evidence_entries
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
CREATE TRIGGER trg_delivery_receipts_append_only BEFORE UPDATE OR DELETE ON delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
CREATE TRIGGER trg_hr_ack_append_only BEFORE UPDATE OR DELETE ON house_rules_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
CREATE TRIGGER trg_notification_log_append_only BEFORE UPDATE OR DELETE ON notification_log
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
