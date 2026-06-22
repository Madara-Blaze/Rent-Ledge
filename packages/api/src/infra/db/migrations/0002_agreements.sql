-- ============================================================================
-- RentLedger — Phase 2: digital rental agreements.
--
--  * `clauses` + `agreement_templates` form the versioned, jurisdiction-keyed
--    clause library. An agreement is rendered from a template + variables.
--  * `agreement_versions` are immutable rendered snapshots (append-only) carrying
--    a content hash. Amendments create a NEW version/agreement (addendum), never
--    an edit. `signer_events` are the append-only e-signature log.
--  * `agreements` is the mutable header (status, current version, stamp/registration).
-- ============================================================================

CREATE TABLE clauses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_key    text NOT NULL,
  jurisdiction  text NOT NULL DEFAULT 'IN',
  property_type text, -- null = applies to any property type
  title         text NOT NULL,
  body          text NOT NULL, -- template text with {{variables}}
  version       int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_clauses_key ON clauses(clause_key, jurisdiction);

CREATE TABLE agreement_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction       text NOT NULL DEFAULT 'IN',
  property_type      text NOT NULL DEFAULT 'RESIDENTIAL',
  name               text NOT NULL,
  version            int NOT NULL DEFAULT 1,
  clause_keys        jsonb NOT NULL, -- ordered array of clause_key strings
  default_term_months int NOT NULL DEFAULT 11,
  reviewed_by_counsel boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_templates_lookup ON agreement_templates(jurisdiction, property_type);

CREATE TABLE agreements (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id            uuid NOT NULL REFERENCES landlords(id),
  tenancy_id             uuid NOT NULL REFERENCES tenancies(id),
  template_id            uuid REFERENCES agreement_templates(id),
  title                  text NOT NULL,
  jurisdiction           text NOT NULL DEFAULT 'IN',
  property_type          text NOT NULL DEFAULT 'RESIDENTIAL',
  term_months            int NOT NULL DEFAULT 11,
  status                 text NOT NULL DEFAULT 'DRAFT'
                           CHECK (status IN ('DRAFT','OUT_FOR_SIGNATURE','PARTIALLY_SIGNED','SIGNED','REGISTERED','AMENDED','VOID')),
  -- stamp duty & registration awareness
  registration_required  boolean NOT NULL DEFAULT false,
  registration_status    text NOT NULL DEFAULT 'NOT_REQUIRED'
                           CHECK (registration_status IN ('NOT_REQUIRED','PENDING','FILED','REGISTERED')),
  stamp_duty_minor       bigint NOT NULL DEFAULT 0 CHECK (stamp_duty_minor >= 0),
  stamp_duty_status      text NOT NULL DEFAULT 'NOT_PAID'
                           CHECK (stamp_duty_status IN ('NOT_PAID','PAID')),
  -- Rent Authority filing (MTA-adopting states)
  rent_authority_required boolean NOT NULL DEFAULT false,
  rent_authority_status  text NOT NULL DEFAULT 'NOT_REQUIRED'
                           CHECK (rent_authority_status IN ('NOT_REQUIRED','PENDING','FILED')),
  rent_authority_due     date,
  rent_authority_ref     text,
  current_version_id     uuid,
  supersedes_id          uuid REFERENCES agreements(id),
  created_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_agreements_tenancy ON agreements(tenancy_id);
CREATE INDEX ix_agreements_landlord ON agreements(landlord_id);

CREATE TABLE agreement_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES agreements(id),
  version      int NOT NULL,
  variables    jsonb NOT NULL,
  clauses      jsonb NOT NULL, -- rendered [{ key, title, body }]
  rendered_text text NOT NULL,
  content_hash text NOT NULL, -- sha256 of the rendered document; locked once signed
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, version)
);
CREATE INDEX ix_agreement_versions ON agreement_versions(agreement_id);

CREATE TABLE signer_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_version_id uuid NOT NULL REFERENCES agreement_versions(id),
  party_role          text NOT NULL CHECK (party_role IN ('LANDLORD','TENANT','GUARANTOR','WITNESS')),
  name                text NOT NULL,
  identifier          text,
  provider            text NOT NULL,
  provider_ref        text,
  document_hash       text,
  ip                  text,
  status              text NOT NULL DEFAULT 'SIGNED' CHECK (status IN ('PENDING','SIGNED','DECLINED')),
  signed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_signer_events_version ON signer_events(agreement_version_id);

-- Rendered versions and the signature log are evidence-grade: append-only.
CREATE TRIGGER trg_agreement_versions_append_only
  BEFORE UPDATE OR DELETE ON agreement_versions
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
CREATE TRIGGER trg_signer_events_append_only
  BEFORE UPDATE OR DELETE ON signer_events
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();
