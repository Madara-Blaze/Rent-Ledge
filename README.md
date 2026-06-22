# RentLedger — Backend

Rental-management SaaS backend (India-first, multi-jurisdiction-ready). This repo currently implements the **financial core** (Phase 3 of the build plan): a double-entry, append-only ledger with invoicing, payments, a deposit subledger, and a data-driven TDS engine. Auth/RBAC, agreements, maintenance, evidence vault, notices and reporting are scaffolded for later phases.

> Stack: **TypeScript + NestJS 11**, **PostgreSQL** (raw SQL migrations for the ledger + Drizzle for the query layer), **pnpm** workspaces. Chosen because NestJS's DI makes every external integration a swappable, mockable adapter; decorators map cleanly to resource-scoped RBAC; `@nestjs/swagger` keeps the OpenAPI spec in sync; and end-to-end TypeScript will let the upcoming web client share types.

```
rentledger/
├─ packages/
│  └─ api/                       # the NestJS backend
│     └─ src/
│        ├─ domain/              # pure, framework-free, fully unit-tested
│        │  ├─ money/            #   Money value object (integer paise, no floats)
│        │  ├─ ledger/           #   accounts + balanced journal-entry builder
│        │  ├─ policy/           #   JurisdictionPolicy types + India defaults
│        │  └─ rules/            #   proration, escalation, late fee, TDS
│        ├─ infra/db/            # Drizzle schema, SQL migrations, migrate/seed
│        └─ modules/             # NestJS: ledger, invoicing, payments, deposits, tax, policy, tenancy
└─ (packages/web — future frontend)
```

## Quick start

```bash
pnpm install

# Run the rule-engine + ledger unit tests (NO database required):
pnpm test

# To run the API you need Postgres + Redis. With Docker:
docker compose up -d
cp .env.example .env
pnpm db:migrate          # apply schema + append-only triggers
pnpm db:seed             # create a full demo tenancy with months of activity
pnpm dev                 # http://localhost:3000  (Swagger UI at /docs)
```

No Docker? Point `DATABASE_URL` in `.env` at any Postgres 14+ instance and run the same `db:migrate` / `db:seed`.

## The ledger model (read this first)

Money correctness is the whole point, so the design is deliberately strict.

**1. Money is integer minor units, never floats.** Every amount is paise (`bigint`) wrapped in a `Money` value object (`domain/money/money.ts`). Rounding is explicit (round-half-away-from-zero); splitting across tenants uses lossless allocation. The wire format is `{ amountMinor: "5500000", currency: "INR" }`.

**2. Double-entry.** Every financial event is one **journal entry** with two or more **postings** whose debits equal credits. The chart of accounts (`domain/ledger/accounts.ts`) includes `RENT_RECEIVABLE`, `RENT_INCOME`, `CASH`, `TENANT_ADVANCE`, `SECURITY_DEPOSIT_LIABILITY`, `TDS_RECEIVABLE`, `LATE_FEE_*`, `DAMAGE_RECOVERY_INCOME`, etc. Each account has a type (ASSET/LIABILITY/INCOME/EXPENSE/EQUITY) that fixes its normal side.

Worked examples:

| Event | Debit | Credit |
|---|---|---|
| Rent invoice ₹55,000 | RENT_RECEIVABLE 55,000 | RENT_INCOME 55,000 |
| Rent paid (UPI) ₹55,000 | CASH 55,000 | RENT_RECEIVABLE 55,000 |
| Paid net of 2% TDS | CASH 53,900 + TDS_RECEIVABLE 1,100 | RENT_RECEIVABLE 55,000 |
| Advance (paid ₹60k, owed ₹55k) | CASH 60,000 | RENT_RECEIVABLE 55,000 + TENANT_ADVANCE 5,000 |
| Deposit collected ₹55,000 | CASH 55,000 | SECURITY_DEPOSIT_LIABILITY 55,000 |
| Move-out deduction ₹5,000 | SECURITY_DEPOSIT_LIABILITY 5,000 | DAMAGE_RECOVERY_INCOME 5,000 |
| Deposit refund ₹50,000 | SECURITY_DEPOSIT_LIABILITY 50,000 | CASH 50,000 |

**3. Append-only + balanced, enforced by the database.** `migrations/0000_init.sql` installs:
- a trigger that **blocks UPDATE/DELETE** on `journal_entries`, `ledger_postings` and `deposit_transactions` — corrections are made with a *reversing* entry, never by mutation;
- a **deferred constraint trigger** that rejects any entry where Σdebits ≠ Σcredits (or where the postings don't reconcile to `total_minor`), checked at COMMIT.

So even a buggy caller cannot persist bad money. The `JournalEntryDraft` builder enforces the same invariant in the domain layer before it ever reaches the DB.

**4. Balances are computed, never stored.** A tenancy's balances and arrears ageing are derived from postings/invoices on demand (`GET /v1/tenancies/:id/ledger`, `/arrears`). There is no mutable "balance" column to drift.

**5. Idempotency.** Every money-moving path accepts an idempotency key. It's stored on the journal entry (unique) so retried requests and duplicate gateway webhooks post **at most once**.

## Rule engine (data-driven)

All legal/tax math lives in `domain/rules/` and reads parameters from `JurisdictionPolicy` — nothing is hardcoded in business logic. Each function is pure and returns a full breakdown, so it doubles as the **dry-run/preview** the spec asks for:

- **Proration** — partial first/last month, actual-days or 30-day basis.
- **Escalation** — scheduled % (compounding or simple) or fixed-amount hikes, with a cap.
- **Late fee** — grace window then flat / %-of-outstanding / per-day, capped.
- **TDS** — 194-IB (individual/HUF, >₹50k/month, 2%, **20% if PAN missing**, on annual rent, Form 26QC/16C) and 194-I (company/firm, >₹2.4L/year, 10%, monthly). GST is excluded from the base; a refundable deposit is never in the base. The **Income-tax Act 2025 → Section 393** consolidation (1 Apr 2026) is handled by mapping the section code by date.

Preview endpoints: `POST /v1/invoices/preview` (escalation + proration) and `GET /v1/tax/tds/preview`.

## How to add a new jurisdiction

Jurisdiction rules are **versioned, effective-dated data** — adding one is a data change, no code:

1. Author a `JurisdictionPolicy` object (see `domain/policy/india-default.policy.ts` as a template): set `jurisdiction` (e.g. `"IN-MH"` or `"AE"`), `version`, `effectiveFrom`/`effectiveTo`, currency/locale, and the `proration`, `lateFee`, `deposit`, `registration`, `noticePeriods` and `tds` blocks.
2. Load it — either insert a row into `jurisdiction_policies` (`{ jurisdiction, version, effective_from, body }`, `body` = the whole JSON), or add it to `DEFAULT_POLICIES` for a shipped default.
3. Point a tenancy at it by setting `tenancies.jurisdiction`. `PolicyService.resolve(jurisdiction, date)` automatically picks the version in force on the relevant date.

**Amending an existing jurisdiction** (e.g. a rate change): add a *new version* with the later `effectiveFrom` and set the previous one's `effectiveTo`. Historic invoices keep computing under the rules that applied on their date.

## API surface (this slice)

`/v1` prefix. Full schema at `/docs` (Swagger UI) and `/docs-json` (OpenAPI).

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/health` | liveness |
| POST | `/v1/invoices/preview` | dry-run rent breakdown |
| POST | `/v1/invoices` | issue rent invoice → ledger |
| POST | `/v1/invoices/late-fee` | apply policy late fee |
| POST | `/v1/payments` | record payment (alloc/advance/TDS), idempotent |
| POST | `/v1/payments/webhook` | gateway webhook (idempotent on event id) |
| POST | `/v1/deposits/collect\|deduct\|refund` | deposit subledger |
| GET | `/v1/deposits/:tenancyId/statement` | settlement statement |
| GET | `/v1/tenancies/:id/ledger` | computed balances |
| GET | `/v1/tenancies/:id/arrears` | arrears ageing |
| GET | `/v1/tax/tds/preview` | TDS determination preview |

> Note: endpoints currently take `landlordId` explicitly as a stand-in for the authenticated principal. Phase 1 (auth + resource-scoped RBAC) will inject it from the request context and scope every query automatically.

## Integration adapters

External integrations sit behind interfaces with mock implementations so the system runs without credentials. Implemented here: **payment gateway** (`PaymentGateway` + `MockPaymentGateway`). Swap the provider in `PaymentsModule`. e-Sign / e-Stamp / KYC / SMS-WhatsApp / object storage follow the same pattern in later phases.

## Tests

`pnpm test` runs the domain suite (Money, the balanced-entry builder, and the full rule engine incl. the PAN-missing surcharge, GST/deposit exclusion, and the 2026 section-code switch) — **no database needed**. Persistence-level integration tests run against a real Postgres and are added with the auth phase.

## What's next (per the build plan)

Phase 1 (auth, RBAC, full property/tenancy lifecycle, audit log), Phase 2 (agreements + e-sign + registration flags), Phase 4 (reports + CA pack), Phase 5 (maintenance, evidence vault, notices, house rules, notifications), Phase 6 (DPDP/security hardening, full integration test suite).

---

**Disclaimer:** RentLedger generates documents and computes statutory figures from configurable policy data. It is **not legal or tax advice**; templates, rates and thresholds require review by qualified counsel for the applicable jurisdiction. Shipped India defaults are flagged `reviewedByCounsel: false`.
