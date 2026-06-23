-- ============================================================================
-- RentLedger — Phase 1: identity, auth, RBAC, lifecycle, audit.
--
--  * `users` is the canonical login identity (multi-role: one person can be an
--    owner on one property and a tenant on another).
--  * `landlords` becomes the owner WORKSPACE/account (the ledger isolation key);
--    each links to an owning user. `tenants` is a party record that a user claims.
--  * `role_assignments` give resource-scoped RBAC + explicit delegation.
--  * `audit_log` is append-only (reuses the rl_prevent_mutation guard from 0000).
-- ============================================================================

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE,
  phone         text UNIQUE,
  name          text NOT NULL,
  password_hash text,
  -- KYC: PAN stored encrypted (AES-256-GCM); only last 4 kept in clear for display.
  pan_encrypted text,
  pan_last4     text,
  pan_valid     boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INVITED')),
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_contactable CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id),
  -- only the SHA-256 of the refresh token is stored; the raw token goes to the client.
  refresh_token_hash text NOT NULL UNIQUE,
  user_agent         text,
  ip                 text,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sessions_user ON sessions(user_id);

CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  text NOT NULL, -- email or phone
  code_hash   text NOT NULL,
  purpose     text NOT NULL DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN', 'SIGNUP', 'VERIFY')),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_otp_identifier ON otp_codes(identifier);

CREATE TABLE role_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  role       text NOT NULL CHECK (role IN ('OWNER', 'CO_OWNER', 'MANAGER', 'ACCOUNTANT', 'TENANT', 'ADMIN')),
  scope_type text NOT NULL CHECK (scope_type IN ('PLATFORM', 'LANDLORD', 'PORTFOLIO', 'PROPERTY', 'TENANCY')),
  scope_id   uuid, -- null only for PLATFORM scope
  granted_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- de-dup; COALESCE so the null PLATFORM scope still de-duplicates.
CREATE UNIQUE INDEX ux_role_assignments ON role_assignments (
  user_id, role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE INDEX ix_roles_user ON role_assignments(user_id);
CREATE INDEX ix_roles_scope ON role_assignments(scope_type, scope_id);

CREATE TABLE portfolios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlords(id),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_portfolios_landlord ON portfolios(landlord_id);

CREATE TABLE tenant_invitations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id      uuid NOT NULL REFERENCES landlords(id),
  tenancy_id       uuid REFERENCES tenancies(id),
  email            text,
  phone            text,
  token_hash       text NOT NULL UNIQUE,
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  invited_by       uuid REFERENCES users(id),
  expires_at       timestamptz NOT NULL,
  accepted_user_id uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_invites_landlord ON tenant_invitations(landlord_id);

CREATE TABLE move_inspections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id      uuid NOT NULL REFERENCES tenancies(id),
  type            text NOT NULL CHECK (type IN ('MOVE_IN', 'MOVE_OUT')),
  condition_notes text,
  checklist       jsonb,
  evidence_refs   jsonb,
  conducted_at    timestamptz,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inspections_tenancy ON move_inspections(tenancy_id);

CREATE TABLE audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  landlord_id   uuid,
  action        text NOT NULL,
  resource_type text,
  resource_id   uuid,
  ip            text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_landlord ON audit_log(landlord_id);
CREATE INDEX ix_audit_actor ON audit_log(actor_user_id);

-- The audit trail is evidence-grade: append-only.
CREATE TRIGGER trg_audit_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION rl_prevent_mutation();

-- ---- Extend existing entities ----
ALTER TABLE landlords  ADD COLUMN owner_user_id uuid REFERENCES users(id);
ALTER TABLE tenants    ADD COLUMN user_id       uuid REFERENCES users(id);
ALTER TABLE properties ADD COLUMN portfolio_id  uuid REFERENCES portfolios(id);
ALTER TABLE tenancies  ADD COLUMN notice_date   date;
ALTER TABLE tenancies  ADD COLUMN ended_at      date;
ALTER TABLE tenancies  ADD COLUMN end_reason    text;
