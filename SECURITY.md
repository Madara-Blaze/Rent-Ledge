# RentLedger — Security Model & Hardening Status

RentLedger is effectively fintech: money (an immutable double-entry ledger, payments,
deposits), PII/KYC (PAN, phone, email), legally-binding e-signed agreements, and
tamper-evident evidence. The security posture is **fail-closed, least-privilege,
defense-in-depth**. This document records the threat model, the controls implemented so
far (with file references), verification evidence, the remaining roadmap, and operational
runbooks.

> Architecture assumption (verified): the React web app talks to Supabase **only via the
> NestJS backend**. Supabase is the Postgres database (and, later, Storage). The browser
> never holds the service-role key or a direct DB connection. RLS is therefore the *net*
> that catches a logic bug or a compromised query path — primary if any direct
> browser→Supabase path is ever added.

---

## 1. Threat model (summary)

**Assets:** the ledger (money), deposits, PII/KYC (PAN), e-signed agreements, the
evidence chain, the audit log, auth secrets and the field-encryption key.

**Primary risks (ranked):**
1. **IDOR / cross-tenant access (BOLA)** — the #1 real-world risk in multi-tenant SaaS.
2. **Direct DB / PostgREST exposure** bypassing app authz.
3. **Auth abuse** — brute force, OTP abuse, token theft, account enumeration.
4. **Tampering** with money/evidence/audit records.
5. **Secret leakage** (service-role key, JWT/encryption keys, PII in logs).
6. **Webhook forgery / replay** on the payments path.
7. **Resource exhaustion / DoS** on expensive endpoints.

---

## 2. Controls implemented (this pass) — mapped to files

### Database layer (Supabase) — §2 — DONE & VERIFIED
- **Default-deny RLS on all 40 tables.** RLS is enabled with **no permissive policy**, so
  the `anon`/`authenticated` PostgREST surface can read/write nothing. Codified in
  [`0005_security_db_hardening.sql`](packages/api/src/infra/db/migrations/0005_security_db_hardening.sql).
- **Append-only enforcement preserved.** 11 `rl_prevent_mutation` triggers block
  UPDATE/DELETE on ledger, postings, deposit transactions, audit log, agreement versions,
  signer events, ticket events, evidence entries, delivery receipts, house-rules
  acknowledgements and the notification log
  ([`0000_init.sql`](packages/api/src/infra/db/migrations/0000_init.sql) and later).
- **Balanced-ledger constraint preserved.** The deferred `rl_assert_entry_balanced`
  constraint trigger guarantees Σdebits = Σcredits per entry.
- **Function hardening.** Pinned `search_path` on both trigger functions; revoked the
  exposed `rls_auto_enable()` RPC from `anon`/`authenticated`/`PUBLIC` (advisors
  0011/0028/0029 cleared).

### Application edge & config — §1, §5, §6 — DONE & VERIFIED
- **§1.4 Boot-time secret validation** — production refuses to boot with default/example
  secrets, secrets < 32 chars, identical access/refresh secrets, or a non-TLS database URL.
  [`config/env.ts`](packages/api/src/config/env.ts) · tested in
  [`config/env.spec.ts`](packages/api/src/config/env.spec.ts).
- **§1.2 Seed guard** — `db:seed` aborts when `NODE_ENV=production` unless `ALLOW_SEED=true`,
  so the `password123` demo logins can never reach prod.
  [`infra/db/seed.ts`](packages/api/src/infra/db/seed.ts).
- **§1.3 Swagger gated** — `/docs` is only mounted outside production.
  [`main.ts`](packages/api/src/main.ts).
- **§1.5 TLS** — production DB URL must carry `sslmode=require` (or be a Supabase host).
- **§5.1 Strict validation** — global `ValidationPipe({ whitelist, forbidNonWhitelisted,
  transform })` rejects unknown/mass-assignment fields; every endpoint already has a typed
  `class-validator` DTO. [`main.ts`](packages/api/src/main.ts).
- **§5.2 SQL injection** — Drizzle parameterizes; raw SQL uses bound `$n` params (audited).
- **§5.3 Money** — integer-paise (`bigint`/string) validated `>= 0`; CHECK constraints in
  the schema; no floats.
- **§6.1 Security headers** — strict CSP (`default-src 'none'`), HSTS (1y, preload),
  `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP/CORP,
  `Permissions-Policy`. [`common/security/security-headers.ts`](packages/api/src/common/security/security-headers.ts).
- **§6.2 CORS** — explicit allowlist, no wildcard, `credentials: true`, restricted
  methods/headers; **fails closed in production** when unconfigured. [`main.ts`](packages/api/src/main.ts).
- **§6.4 Request hygiene** — `x-powered-by` disabled; JSON/urlencoded bodies capped at
  512 kB; raw-body capture enabled for webhook signatures. [`main.ts`](packages/api/src/main.ts).
- **§6/§7 Layered rate limiting** — global ceiling plus tight buckets on auth/OTP (10/min
  per IP), payments (30/min), and exports/reports (10/min), returning `429` with
  `retryAfter`. [`common/security/rate-limit.guard.ts`](packages/api/src/common/security/rate-limit.guard.ts).

### Already present (verified, not weakened)
- **§4 Authorization** — `AccessService` derives the workspace/tenancy from the **resource**
  (never from a client-supplied id) and enforces the role matrix; global `JwtAuthGuard` is
  fail-closed (deny unless `@Public()`). [`modules/rbac/access.service.ts`](packages/api/src/modules/rbac/access.service.ts).
- **§10 Audit** — append-only `audit_log` via interceptor + domain events.
- **Crypto** — scrypt passwords, AES-256-GCM field encryption (PAN last-4 only in clear),
  refresh-token rotation with server-side revocation.

---

## 3. Verification evidence
- Supabase **security advisor**: all WARN findings cleared; only the intended INFO
  `rls_enabled_no_policy` (default-deny) remains on all 40 tables.
- Live DB checks: `anon` SELECT on `journal_entries` returns **0 rows**; an UPDATE on a
  journal entry is **blocked** by the append-only trigger (both run via sentinel rollback,
  no rows persisted).
- App: `tsc --noEmit` clean; **91 unit tests green** (85 original + 6 new env-hardening
  tests); 1 DB integration test skipped (no live DB in CI).

---

## 4. Remaining roadmap (next phases)

These are scoped and ordered; several need a deployment decision or infra.

1. **§1.1 Cookie-based auth + CSRF.** Move JWTs out of `localStorage` to `httpOnly`+`Secure`
   `SameSite=Strict` cookies with a CSRF double-submit token on state-changing routes.
   Cross-cutting (backend issue/verify + web client + the demo adapter). Raw-body and
   `credentials: true` CORS are already in place for it.
2. **§2.3 Least-privilege DB role + granular RLS policies.** Create a non-superuser
   `rentledger_app` role (no `BYPASSRLS`), have the backend `SET LOCAL app.current_user`
   per transaction, and add per-workspace `USING`/`WITH CHECK` policies keyed to
   `current_setting('app.current_user')`. Then `FORCE ROW LEVEL SECURITY`. (Today the
   backend uses the privileged service connection; default-deny already protects the
   exposed surface.)
3. **§4.3 IDOR/RBAC test matrix.** For every sensitive endpoint, assert workspace-A user →
   403/404 on workspace-B resources, tenant → no owner actions, accountant → read-only.
4. **§3 Auth depth.** Uniform responses/timing on login/signup/OTP/invite (anti-enumeration);
   per-account lockout/backoff; refresh-reuse detection (revoke the family); consider RS256.
5. **§9 Webhook signature + replay.** Verify the gateway HMAC over the **raw** body
   (now captured) with a timestamp/nonce window; reconcile amounts against the invoice/ledger.
6. **§10 Log redaction.** Structured logger that redacts PAN/phone/email/tokens/OTP, with a
   redaction-allowlist test.
7. **§8 Key management.** Move the field-encryption + JWT keys to a KMS/secret manager;
   versioned rotation (encrypt-new / decrypt-old-by-id).
8. **§11 CI security gates.** `pnpm audit`/osv-scanner, Semgrep/CodeQL SAST, gitleaks
   secret scan; Dependabot/Renovate.

### Infrastructure / Supabase-dashboard steps (operator action)
- **Network**: restrict direct Postgres to backend egress IPs; use the **Supavisor pooler**;
  disable/limit PostgREST exposure if unused (RLS already default-deny if used).
- **Storage** (evidence/agreements/KYC): private buckets only; short-TTL signed URLs minted
  server-side after authz; validate content-type/size; verify the stored content hash.
- **Backups**: enable **PITR** and test a restore (append-only data has no app-level undo).
- **Edge**: front with a CDN/WAF (e.g. Cloudflare) for L3/L4 + bot mitigation + edge rate limits.
- **Frontend CSP**: serve the web app with a CSP allowing exactly its origins —
  `prod.spline.design` (3D), `stream.mux.com` + `*.cloudfront.net` (video), Google Fonts,
  `res.cloudinary.com` — and nothing else; no broad `unsafe-inline`/`unsafe-eval`.
- **CI grep**: fail the build if the web bundle contains `service_role` or the service-role key.

---

## 5. Runbooks

### Key rotation
- **Field-encryption key (PAN/PII):** generate `openssl rand -base64 32`; deploy as the new
  key id; encrypt new writes with it and decrypt existing rows by stored key id; never log keys.
- **JWT signing secret:** support multiple valid *verify* keys during rotation; rotate the
  *sign* key, then retire the old verify key after max refresh-TTL has elapsed.
- **Adapter credentials** (payments/e-sign/e-stamp/KYC/notifications): least-privilege, scoped,
  rotated on a schedule and on suspected compromise.

### Backup & restore
- Enable Supabase **PITR**. Quarterly: restore to a scratch project and verify the ledger
  balances and evidence chain reconcile. Document RPO/RTO.

### Incident response (suspected breach)
1. Rotate all secrets (JWT, field key, service-role, adapter creds). 2. Revoke all sessions.
3. Snapshot the audit log + evidence chain (append-only — preserved). 4. Use the audit log
   to scope impact; notify per DPDP breach-notification obligations. 5. Post-mortem + add a
   regression test.

---

## 6. Acceptance checklist (§12)
- [x] RLS enabled, default-deny on **every** table; cross-tenant read denied at the DB level.
- [x] Append-only triggers + `Σdebits=Σcredits` still enforced (UPDATE rejected — tested).
- [x] Global `ValidationPipe` (whitelist + forbidNonWhitelisted).
- [x] Security headers (CSP/HSTS/…), strict CORS allowlist, body limits, `x-powered-by` off.
- [x] Layered rate limiting with tight buckets on auth/OTP/payments/exports.
- [x] Boot-time secret validation; demo seed impossible in prod; `/docs` gated in prod.
- [x] Service-role key / direct DB string absent from the web bundle (no `VITE_*` secret).
- [x] All existing 85 tests green + new security tests added (91 total).
- [ ] Cookie auth + CSRF (§1.1) — roadmap.
- [ ] Least-privilege DB role + granular RLS policies (§2.3) — roadmap.
- [ ] IDOR/RBAC cross-tenant test matrix (§4.3) — roadmap.
- [ ] Webhook signature + replay (§9), log redaction (§10), KMS rotation (§8), CI gates (§11) — roadmap.
- [ ] Infra: WAF/CDN, network restrictions, PITR, private Storage + signed URLs — operator action.
