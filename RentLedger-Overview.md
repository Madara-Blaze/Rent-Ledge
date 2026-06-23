# RentLedger — Complete Overview

> The single source of truth for the landlord–tenant relationship: digital agreements, automated rent on a paise-accurate double-entry ledger, deposits, maintenance, a tamper-evident evidence vault, typed legal notices, and tax-ready reporting. **India-first, multi-jurisdiction-ready.**

**Status:** backend build **Phases 1–6 complete**; **85 unit tests green**; everything typechecks and builds. Web app builds clean. Mock adapters ship for every external integration so it runs end-to-end without live credentials.

> ⚠️ **Not legal or tax advice.** Figures and documents are generated from configurable, versioned policy data and require review by qualified counsel. See §9.

---

## 1. Tech stack & architecture

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces (`packages/api`, `packages/web`) |
| Backend | TypeScript · **NestJS 11** · PostgreSQL · Drizzle (queries) + raw SQL migrations (ledger triggers) |
| Auth/crypto | Dependency-free: scrypt passwords, HS256 JWT, AES-256-GCM field encryption (Node core) |
| Web | **React 19** · Vite 6 · Tailwind CSS v4 · `motion` (motion/react) · react-router-dom 7 · shadcn-style structure |
| Money | Integer **minor units (paise)** everywhere — no floats |
| Tests | Vitest (domain + rules + crypto + RBAC) |

**Design principles:** money is sacred (immutable double-entry ledger, balances computed not stored); legal/tax rules are **data-driven** by jurisdiction + effective date; every external integration is a **pluggable, mockable adapter**; evidence-grade records are **append-only, enforced by the database**.

---

## 2. Repository layout

```
rentledger/
├─ packages/
│  ├─ api/                      # NestJS backend
│  │  └─ src/
│  │     ├─ domain/             # pure, framework-free, unit-tested
│  │     │  ├─ money/ ledger/ policy/ rules/
│  │     │  ├─ agreements/ evidence/ notices/ reports/ compliance/
│  │     ├─ common/             # crypto, auth guard/decorators, security, error filter
│  │     ├─ infra/db/           # Drizzle schema, SQL migrations (0000–0004), migrate/seed
│  │     └─ modules/            # auth, rbac, properties, tenancies, agreements, ledger,
│  │                            # invoicing, payments, deposits, tax, reports, maintenance,
│  │                            # evidence, notices, house-rules, notifications, audit,
│  │                            # admin (policies), dpdp
│  └─ web/                      # React landing + dashboard
└─ docs / README / FEATURES / this file
```

---

## 3. Roles & access model

| Role | Capabilities |
|---|---|
| **Owner** | Full control of their workspace (properties, tenancies, finances, agreements, delegation) |
| **Co-owner** | Shared ownership; ownership-level actions |
| **Manager / Agent** | Operational writes (properties, invoices, payments, tickets) — no ownership actions |
| **Accountant / CA** | Read-only + report/CSV export, scoped to finances |
| **Tenant** | Self-service for their own tenancy (pay, view, acknowledge, raise tickets, sign) |
| **Platform Admin** | Jurisdiction-policy management, ops, audit |

- **Resource-scoped RBAC** via `role_assignments` (PLATFORM / LANDLORD / PORTFOLIO / PROPERTY / TENANCY).
- Explicit **delegation** (grant/revoke per workspace). Strict **per-workspace data isolation** — every query scoped; money endpoints derive the workspace from the resource and enforce access from the JWT.

---

## 4. Feature catalogue (frontend + backend)

### 4.1 Identity, authentication & accounts
- Email/phone **signup & login** (password) + **passwordless OTP** (pluggable delivery; dev returns the code).
- **Refresh-token sessions** with rotation; logout/revocation.
- **Multi-role accounts** (owner on one property, tenant on another).
- **Tenant invitation flow** (invite by email/phone → claim → linked to tenancy).
- **KYC**: PAN captured, validated, **encrypted at rest** (only last-4 in clear).

### 4.2 RBAC & delegation
- Role matrix above; grant/revoke endpoints; CA read-only export scope; tenant tenancy-scope.

### 4.3 Property & tenancy management
- Hierarchy **Portfolio → Property → Unit → Tenancy** (CRUD).
- Property types: residential / commercial / PG / co-living.
- **Tenancy lifecycle**: draft → agreement-pending → active → notice-period → ended (+ renewed / terminated / evicted) with guarded transitions.
- **Move-in / move-out inspections** (notes, checklist, evidence refs).

### 4.4 Digital rental agreements
- **Clause-based template engine** — versioned, jurisdiction-keyed clauses with `{{variable}}` interpolation; default India residential template.
- **e-Signature** via pluggable provider (Aadhaar eSign / DocuSign-style): captures signer identity, timestamp, IP, signed-document **hash**.
- **Immutable versioning** — rendered versions + signer log are append-only; amendments create a linked **addendum**; locks once landlord + tenant sign.
- **Stamp duty & registration awareness** + **Rent Authority filing** tracking (see §9).

### 4.5 Money — ledger, invoicing, payments, deposits
- **Double-entry, append-only ledger** is the source of truth; balances **computed**, never stored.
- **Invoicing**: proration (partial first/last month), rent **escalation** (compounding/simple/capped), GST-ready fields.
- **Late fees**: grace + flat / %-of-outstanding / per-day, capped.
- **Payments**: gateway adapter (UPI/cards/netbanking; mock + **webhook**) and manual/offline; **partial payments, advances, FIFO allocation**; **idempotency keys** on all money-moving endpoints.
- **TDS withholding** captured as a ledger posting.
- **Security-deposit subledger**: collection, deductions (evidence-tied), refund, **settlement statement**.
- **Arrears ageing** (0–30 / 31–60 / 61–90 / 90+).

### 4.6 Tax & reporting
- **TDS engine** (§9) + **TDS summary** per tenancy/period.
- **Rental-income statement**, **expense report**, **per-property P&L**, **deposits summary** — parameterised by date / property / tenancy.
- **Year-end CA pack** (income, expenses, TDS, deposits) with **CSV export**.

### 4.7 Maintenance & service requests
- Ticketing (open → assigned → in-progress → resolved → closed), raised by tenant or staff.
- **Vendor directory** (contact, category, rating); ticket event timeline.
- **Cost-bearer logic** — tenant-borne cost **charges back to the ledger** automatically.

### 4.8 Evidence vault & disputes
- **Hash-chained, append-only** evidence log (content hash + prior hash) — tampering detectable; **verify** walks the chain.
- **Evidence bundle export** — chronological, hash-verified, with a verification manifest (for a Rent Authority / tribunal).
- **Dispute cases** linking evidence + resolution.

### 4.9 Notices & communications
- **Typed legal notices** (rent reminder, payment default, rent increase, renewal, termination, deposit deduction, eviction) with **jurisdiction-aware notice periods enforced before sending**.
- Each notice is **written to the evidence vault**, dispatched via the notification engine, and gets **delivery receipts**.

### 4.10 House rules
- **Versioned** per-property documents; **tenant acknowledgement** (timestamped); re-acknowledge on change.

### 4.11 Notification engine
- One interface, channels: email / SMS / WhatsApp / push / in-app (mock adapters); every send logged.

### 4.12 Audit & admin
- **Global append-only audit log** (who/what/when/where) via interceptor + domain events.
- **Admin**: versioned, effective-dated **jurisdiction-policy** CRUD (rates, caps, notice periods, registration triggers).

### 4.13 DPDP & security
- **Consent** capture (grant/withdraw), **data export** (right to access), **erasure requests**, **PII masking**.
- Global JWT guard, **rate limiting**, **security headers**, input validation, encrypted PII, no secrets/PII in logs.

### 4.14 Web application
- Marketing **landing page** (3D Spline hero with video backdrop, animated parallax CTA section, BlurFade typography), **auth pages** (login/signup).
- Authenticated **tabbed dashboard**: Overview (balances, arrears, deposit, TDS, record payment), Agreements (create/send/sign), Maintenance, Notices, House rules, Evidence (chain-integrity badge), Reports (income/P&L + CA-pack CSV download).
- JWT in localStorage with **auto-refresh**; **accessible** tabs (roles/aria), keyboard focus states.

---

## 5. Backend internals (the parts that matter)

**Double-entry ledger.** Every financial event is one journal entry with ≥2 postings whose debits equal credits. Examples:

| Event | Debit | Credit |
|---|---|---|
| Rent invoice ₹55,000 | RENT_RECEIVABLE | RENT_INCOME |
| Rent paid (UPI) | CASH | RENT_RECEIVABLE |
| Paid net of 2% TDS | CASH + TDS_RECEIVABLE | RENT_RECEIVABLE |
| Advance (overpay) | CASH | RENT_RECEIVABLE + TENANT_ADVANCE |
| Deposit collected | CASH | SECURITY_DEPOSIT_LIABILITY |
| Move-out deduction | SECURITY_DEPOSIT_LIABILITY | DAMAGE_RECOVERY_INCOME |
| Maintenance chargeback (tenant) | RENT_RECEIVABLE | MAINTENANCE_RECOVERY_INCOME |

**Append-only, DB-enforced.** Postgres triggers block UPDATE/DELETE on `journal_entries`, `ledger_postings`, `deposit_transactions`, `audit_log`, `agreement_versions`, `signer_events`, `evidence_entries`, `delivery_receipts`, `house_rules_acknowledgements`, `notification_log`, `ticket_events`. A deferred constraint trigger guarantees Σdebits = Σcredits per entry. Corrections are reversing entries; amendments are addenda — never edits.

**Idempotency.** Money-moving paths accept idempotency keys (stored on the journal entry, unique) so retries and duplicate webhooks post at most once.

**Data-driven jurisdiction policy.** TDS rates, deposit caps, notice periods, registration triggers, late-fee defaults are **versioned, effective-dated JSON** keyed by jurisdiction — added/amended without code changes.

**Pluggable adapters (mock + interface):** payment gateway, e-signature, stamp-duty/e-stamp, notification channels (email/SMS/WhatsApp/push/in-app). KYC/object-storage follow the same pattern.

**Migrations:** `0000` ledger · `0001` auth/rbac · `0002` agreements · `0003` operations (maintenance/evidence/notices/house-rules/notifications) · `0004` compliance (consent/data-subject-requests).

---

## 6. API surface (selected, prefix `/v1`, OpenAPI at `/docs`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/signup` · `login` · `otp/request` · `otp/verify` · `refresh` · `logout` · `invitations/accept` · `GET /auth/me` · `POST /auth/kyc/pan` |
| RBAC | `GET/POST/DELETE /workspaces/:id/roles` |
| Properties | `…/portfolios` · `…/properties` · `/properties/:id/units` |
| Tenancies | `…/tenancies` · `/tenancies/:id` · `/transition` · `/inspections` · `/invitations` |
| Agreements | `POST /agreements` · `/:id/send` · `/:id/sign` · `/:id/addendum` · `/:id/compliance` · `GET /tenancies/:id/agreements` |
| Money | `POST /invoices` · `/invoices/preview` · `/invoices/late-fee` · `POST /payments` · `/payments/webhook` · `POST /deposits/collect\|deduct\|refund` |
| Ledger/Tax | `GET /tenancies/:id/ledger` · `/arrears` · `/deposits/:id/statement` · `GET /tax/tds/preview` |
| Reports | `…/reports/income-statement` · `expense-report` · `pnl` · `tds-summary` · `deposits-summary` · `ca-pack` · `ca-pack.csv` |
| Maintenance | `…/vendors` · `…/maintenance/tickets` · `/maintenance/tickets/:id` |
| Evidence | `…/evidence` · `/evidence/verify` · `/evidence/bundle` · `…/disputes` |
| Notices | `POST /notices` · `/:id/send` · `GET /tenancies/:id/notices` |
| House rules | `…/house-rules` · `/tenancies/:id/house-rules` · `/house-rules/:id/acknowledge` |
| Audit/Admin | `GET /workspaces/:id/audit` · `GET/POST /admin/policies` |
| Privacy (DPDP) | `POST /me/consents` · `GET /me/consents` · `GET /me/data-export` · `POST /me/erasure-request` |

---

## 7. Core data model (entities)

`User`, `RoleAssignment`, `Landlord (workspace)`, `Portfolio`, `Property`, `Unit`, `Tenancy`, `Tenant (party)`, `TenantInvitation`, `MoveInspection`, `Agreement` + `AgreementVersion` + `SignerEvent` + `Clause`/`AgreementTemplate`, `Invoice`, `Payment` + `PaymentAllocation`, `LedgerAccount` + `JournalEntry` + `LedgerPosting`, `DepositAccount` + `DepositTransaction`, `MaintenanceTicket` + `TicketEvent` + `Vendor`, `EvidenceEntry` (hash-chained) + `DisputeCase`, `Notice` + `DeliveryReceipt`, `HouseRulesVersion` + `Acknowledgement`, `Notification`, `JurisdictionPolicy`, `AuditLog`, `Consent`, `DataSubjectRequest`, `Session`, `OtpCode`, `IdempotencyKey`.

---

## 8. Legal & compliance coverage (for a business)

> **Disclaimer.** RentLedger generates documents and computes statutory figures from **configurable, versioned policy data**. It is **not legal or tax advice**; templates, rates and thresholds **require review by qualified counsel** for the applicable jurisdiction. Shipped India defaults are flagged `reviewedByCounsel: false`.

### Income-tax / TDS on rent (India)
- **Section 194-IB** — individual/HUF tenants, rent **> ₹50,000/month**: **2%** (or **20% if landlord PAN missing/invalid**), on the year's rent; **Form 26QC** + **Form 16C**.
- **Section 194-I** — companies/firms/audited payers: **10%** on building rent above the annual threshold.
- **GST excluded** from the TDS base; a **genuinely refundable deposit is not subject to TDS**.
- **Income-tax Act 2025 → Section 393** consolidation (effective **1 Apr 2026**) — old↔new codes mapped by date.

### Stamp duty & registration
- **Registration Act** trigger: term **> 11 months** flagged for registration (templates default to 11 months).
- **State stamp-duty** via pluggable provider (e-stamp hook); status tracked.
- **Rent Authority filing** (Model Tenancy Act states): filing task + statutory window (~60 days) + reference tracking.

### Agreement integrity & e-signatures
- Signed agreements are **immutable and hash-locked**; signer log records identity, timestamp, IP, document hash. Amendments are addenda, preserving the original.

### Evidence & dispute readiness
- **Tamper-evident hash-chained** record of notices, payments, inspections, documents; exportable as a verifiable bundle for a **Rent Authority / Rent Tribunal**.
- Append-only ledger, audit log, receipts, signer events, deposit transactions, notices and acknowledgements — enforced by **DB triggers**.

### Tenant-protection rules (data-driven by jurisdiction)
- **Security-deposit caps** (e.g. residential 2 months under MTA).
- **Statutory notice periods** enforced before termination / rent increase / default.
- Deposit move-out **settlement statements** with deductions tied to inspection evidence.

### Data protection — DPDP Act, 2023
- **Consent** capture (purpose-bound, grant/withdraw), **right to access** (export), **right to erasure** (request workflow within retention limits).
- **Data minimisation / masking** of PAN, phone, email; **PAN encrypted at rest**; **no PII in logs**; breach-notification & retention hooks; controlled, logged hard-delete.

### GST
- GST-compliant invoice fields where the landlord is GST-registered (commercial lets); GST shown separately and excluded from the TDS base. (Full GST return generation is a reporting extension.)

### Financial correctness
- All money in **integer paise** — no floats; every balance derivable from an immutable double-entry ledger with a DB-enforced debits = credits guarantee.

---

## 9. Run · test · build

```bash
pnpm install
pnpm --filter @rentledger/api test          # 85 unit tests, no DB needed
pnpm --filter @rentledger/api demo          # no-DB engine walkthrough (ledger + rules)

# Live stack (needs Postgres):
docker compose up -d
cp .env.example .env
pnpm db:migrate && pnpm db:seed             # seeds demo owner/tenant (password123)
pnpm --filter @rentledger/api dev           # API :3000, Swagger /docs
pnpm --filter @rentledger/web dev           # web :5173
```

Demo logins (after seed): `owner@example.com` / `tenant@example.com`, both `password123`.

---

## 10. Status & caveats

- Backend Phases **1–6 complete**; 85 unit tests green; `tsc` + `nest build` + web `vite build` all clean.
- Logic is unit-tested + typechecked but has **not been run against a live Postgres** in the build environment — migrate/seed and smoke-test before relying on it.
- Mock adapters (payment, e-sign, e-stamp, KYC, SMS/WhatsApp/email, storage) need **live providers** for production.
- A production **security review** and **counsel/jurisdiction certification** of templates and rates is required before real-world use.
