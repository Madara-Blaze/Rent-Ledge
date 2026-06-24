-- ============================================================================
-- RentLedger — Tier-1: lease document storage.
--
-- A record of an uploaded (and optionally already-signed) lease document. The
-- bytes live behind a pluggable storage adapter (local disk in dev, object
-- storage in prod); this table holds only metadata + a SHA-256 of the content
-- for integrity. It is APPEND-ONLY: a signed-document record is legal evidence,
-- so corrections are made by uploading a superseding document, never by edit.
-- (Full e-sign / signer events land later; this is just file + what-was-signed.)
-- ============================================================================

CREATE TABLE lease_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id  uuid NOT NULL REFERENCES landlords(id),
  tenancy_id   uuid NOT NULL REFERENCES tenancies(id),
  agreement_id uuid REFERENCES agreements(id),
  kind         text NOT NULL DEFAULT 'LEASE' CHECK (kind IN ('LEASE','ADDENDUM','OTHER')),
  file_name    text NOT NULL,
  content_type text NOT NULL,
  size_bytes   bigint NOT NULL,
  storage_key  text NOT NULL,
  sha256       text NOT NULL,
  signed_at    timestamptz,
  signed_by    text,
  notes        text,
  uploaded_by  uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_lease_documents_tenancy ON lease_documents(tenancy_id);
CREATE INDEX ix_lease_documents_landlord ON lease_documents(landlord_id);

-- Append-only guard (mirrors the evidence-grade tables from 0003).
CREATE TRIGGER trg_lease_documents_append_only BEFORE UPDATE OR DELETE ON lease_documents
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();

-- SECURITY: default-deny RLS (the NestJS service connection bypasses RLS and
-- enforces tenant isolation in app code; this denies the PostgREST surface).
ALTER TABLE lease_documents ENABLE ROW LEVEL SECURITY;
