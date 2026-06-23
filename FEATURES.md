# RentLedger — Features & Legal Coverage

RentLedger is the single source of truth for the landlord–tenant relationship: digital agreements, automated rent on a paise-accurate ledger, deposits, maintenance, a tamper-evident evidence vault, typed legal notices, and tax-ready reporting. India-first, multi-jurisdiction-ready.

Status: backend build **Phases 1–6 complete** (NestJS + Postgres), web app (React 19 + Vite + Tailwind v4). 85 unit tests green; everything typechecks and builds. Mock adapters ship for every external integration so it runs end-to-end without live credentials.

---

## 1. Feature inventory

### Identity, authentication & accounts
- Email/phone **signup & login** (password) and **passwordless OTP** login (pluggable delivery; mock in dev).
- **Refresh-token sessions** with rotation; logout/revocation.
- **Multi-role accounts** — one person can be an owner on one property and a tenant on another.
- **Tenant invitation flow** — landlord invites by email/phone → tenant claims account → linked to the tenancy.
- **KYC**: PAN capture, format-validated and **encrypted at rest** (AES-256-GCM); only last-4 kept in clear.

### Roles & access control (RBAC)
- Roles: **Owner, Co-owner, Manager/Agent, Accountant/CA, Tenant, Platform Admin**.
- **Resource-scoped permissions** (workspace / portfolio / property / tenancy) with explicit **delegation** (grant/revoke per workspace).
- Read-only, export-scoped access for the **CA/Accountant**; tenants are scoped to their own tenancy.
- Strict **per-landlord (workspace) data isolation** — every query is scoped.

### Property & tenancy management
- Hierarchy: **Portfolio → Property → Unit → Tenancy** with CRUD.
- Property types: residential / commercial / PG / co-living.
- **Tenancy lifecycle**: draft → agreement-pending → active → notice-period → ended (+ renewed / terminated / evicted), with guarded transitions.
- **Move-in / move-out inspections** (condition notes, checklist, evidence references).

### Digital rental agreements
- **Clause-based template engine** — versioned, jurisdiction-keyed clauses with `{{variable}}` interpolation; ships a default India residential template.
- **e-Signature** via a pluggable provider (Aadhaar eSign / DocuSign-style) — captures signer identity, timestamp, IP and the signed-document **hash**.
- **Versioning & immutability** — rendered versions and the signer log are **append-only**; amendments create a linked **addendum**, never an in-place edit. Locks once landlord + tenant sign.
- **Stamp duty & registration awareness** and **Rent Authority filing** tracking (see §2).

### Rent collection & money (the financial core)
- **Double-entry, append-only ledger** is the source of truth; balances are *computed*, never stored.
- **Invoicing** with **proration** (partial first/last month), **rent escalation** (compounding/simple/capped), GST-ready fields.
- **Late fees** — configurable grace + flat / %-of-outstanding / per-day, capped.
- **Payments** — gateway adapter (UPI/cards/netbanking; mock + **webhook**) and manual/offline entry; **partial payments, advances, FIFO allocation**, idempotency keys on all money-moving endpoints.
- **TDS withholding** captured as a ledger posting (tenant-deducted tax → receivable).
- **Security-deposit subledger** — collection, deductions (evidence-tied), refund, and a **settlement statement**.
- **Maintenance chargebacks** post to the tenant ledger when tenant-borne.

### Tax & reporting
- **TDS engine** (see §2) and **TDS summary** (per tenancy / period).
- **Rental-income statement**, **expense report**, **per-property P&L**, **deposits summary** — parameterised by date range / property / tenancy.
- **Year-end CA pack** (income, expenses, TDS, deposits) with **CSV export**.

### Maintenance & service requests
- **Ticketing** (open → assigned → in-progress → resolved → closed) raised by tenant or staff.
- **Vendor directory** (contact, category, rating); ticket event timeline.
- **Cost-bearer logic** — tenant-borne cost auto-**charges back to the ledger**.

### Evidence vault & disputes
- **Hash-chained, append-only evidence log** (each entry binds content hash + prior hash) — tampering is detectable; a **verify** endpoint walks the chain.
- **Evidence bundle export** — chronological, hash-verified, with a verification manifest (suitable for a Rent Authority / tribunal).
- **Dispute case** objects linking related evidence + resolution notes.

### Notices & communications
- **Typed legal notices** (rent reminder, payment default, rent increase, renewal, termination, deposit deduction, eviction) with **jurisdiction-aware notice periods enforced** before sending.
- Every notice is **written to the evidence vault**, dispatched via the notification engine, and gets **delivery receipts**.

### House rules
- **Versioned** per-property house-rules documents; **tenant acknowledgement** (timestamped), re-acknowledgement on new versions.

### Notification engine
- One interface, multiple channels (email / SMS / WhatsApp / push / in-app) with mock adapters; every send recorded in a **notification log** for audit.

### Audit, admin & compliance
- **Global append-only audit log** (who/what/when/where) via a global interceptor + explicit domain events.
- **Admin**: versioned, effective-dated **jurisdiction-policy** CRUD (rates, caps, notice periods, registration triggers).
- **DPDP** consent capture, **data export** (right to access), **erasure requests**, PII masking helpers (see §2).
- **Security**: global JWT guard, rate limiting, security response headers, validation, encrypted PII, no secrets/PII in logs.

### Web application
- Marketing **landing page** (3D hero, animated CTA, parallax) and **auth pages** (login / signup).
- Authenticated **dashboard** with sections: Overview (ledger balances, arrears ageing, deposit, TDS, record payment), Agreements (create/send/sign), Maintenance, Notices, House rules, Evidence (chain-integrity badge), Reports (income/P&L + CA-pack CSV download).
- JWT stored client-side with **auto-refresh**; accessible tabs (roles/aria), keyboard focus states.

---

## 2. Legal & compliance coverage (for a business)

> **Not legal or tax advice.** RentLedger generates documents and computes statutory figures from **configurable, versioned policy data**. Templates, rates and thresholds **require review by qualified counsel** for the applicable jurisdiction; shipped India defaults are flagged `reviewedByCounsel: false`. All rules are data-driven by jurisdiction + effective date, so they can be updated without code changes.

### Income-tax / TDS on rent (India)
- **Section 194-IB** — individual/HUF tenants paying rent **above ₹50,000/month**: **2%** (or **20% if the landlord's PAN is missing/invalid**), on the year's rent, **Form 26QC** filing + **Form 16C** certificate.
- **Section 194-I** — companies/firms/audited payers: **10%** on building rent above the annual threshold.
- **GST excluded** from the TDS base; a **genuinely refundable security deposit is not subject to TDS**.
- **Income-tax Act 2025 → Section 393** consolidation (effective **1 Apr 2026**) — old↔new section codes mapped by date so exports use the right code.
- TDS is tracked against each tenancy and reflected in the ledger; year-end pack supports CA filing.

### Stamp duty & registration
- **Registration Act trigger**: lease terms **> 11 months** are flagged as requiring registration (templates default to 11 months).
- **State stamp-duty** calculation via a pluggable provider (e-stamp integration hook); status tracked on the agreement.
- **Rent Authority filing** (Model Tenancy Act-adopting states): a filing task + statutory window (default ~60 days) with reference tracking.

### Agreement integrity & e-signatures
- Signed agreements are **immutable and hash-locked**; the signer log records identity, timestamp, IP and document hash — supporting authenticity/evidentiary value. Amendments are addenda, preserving the original.

### Evidence & dispute readiness
- **Tamper-evident, hash-chained** record of notices, payments, inspections and documents; exportable as a verifiable bundle for a **Rent Authority / Rent Tribunal**.
- **Append-only** ledger, audit log, receipts, signer events, deposit transactions, notices and acknowledgements — enforced by **database triggers**, not just application code.

### Tenant-protection rules (data-driven by jurisdiction)
- **Security-deposit caps** (e.g. residential 2 months under the Model Tenancy Act).
- **Statutory notice periods** enforced before termination / rent increase / default actions.
- Deposit move-out **settlement statements** with deductions tied to inspection evidence.

### Data protection — DPDP Act, 2023
- **Consent capture** (purpose-bound) with grant/withdraw logging.
- **Right to access** (data export) and **right to erasure** (request workflow respecting legal-retention windows).
- **Data minimisation / masking** of PAN, phone and email; **PAN encrypted at rest**; no PII in logs.
- Breach-notification and retention hooks; soft-delete with controlled, logged hard-delete.

### GST
- GST-compliant invoice fields where the landlord is GST-registered (commercial lets); GST shown separately and excluded from the TDS base. (Full GST return generation is a reporting extension.)

### Financial correctness
- All money in **integer minor units (paise)** — no floats; every balance is derivable from an **immutable double-entry ledger** with a DB-enforced "debits = credits" guarantee.

---

## 3. Caveats / not yet done
- Mock adapters (payment gateway, e-sign, e-stamp, KYC, SMS/WhatsApp/email, object storage) need replacing with **live providers** for production.
- Logic is unit-tested + typechecked but has **not been run against a live Postgres** in this environment — run `db:migrate && db:seed` and smoke-test.
- A production **security review and counsel/jurisdiction certification** of templates and rates is required before real-world use.
