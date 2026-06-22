-- ============================================================================
-- RentLedger — Phase 6: DPDP compliance (consent + data-subject requests).
-- ============================================================================

CREATE TABLE consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  purpose     text NOT NULL, -- e.g. KYC, MARKETING, EVIDENCE_PROCESSING
  granted     boolean NOT NULL DEFAULT true,
  granted_at  timestamptz,
  withdrawn_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_consents_user ON consents(user_id);

CREATE TABLE data_subject_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  type         text NOT NULL CHECK (type IN ('EXPORT','ERASURE')),
  status       text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','REJECTED')),
  details      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ix_dsr_user ON data_subject_requests(user_id);
