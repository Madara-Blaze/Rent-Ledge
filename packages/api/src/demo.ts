/**
 * RentLedger engine demo — runs WITHOUT a database.
 *
 * It drives the exact domain code the API services use (Money, the double-entry
 * JournalEntryDraft, the rule engine, and the India jurisdiction policy) through
 * a tiny in-memory ledger, so you can watch invoicing → payments → advances →
 * late fees → deposit → TDS and the resulting balances.
 *
 *   pnpm --filter @rentledger/api demo
 */
import { AccountCode, signedBalanceMinor } from './domain/ledger/accounts';
import { AccountRef, JournalEntryDraft, JournalEntryDraftData, LedgerEntryType } from './domain/ledger/journal';
import { Money } from './domain/money/money';
import { INDIA_DEFAULT_POLICY } from './domain/policy/india-default.policy';
import { resolvePolicy } from './domain/policy/jurisdiction-policy';
import { EscalationSchedule, escalatedRent } from './domain/rules/escalation';
import { computeLateFee } from './domain/rules/late-fee';
import { prorateRent } from './domain/rules/proration';
import { determineTds } from './domain/rules/tds';

const CUR = 'INR';
const inr = (minor: number) => Money.of(minor, CUR);
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (m: Money) => m.format('en-IN');
const fmtMinor = (minor: bigint) => Money.of(minor, CUR).format('en-IN');

// ---- in-memory ledger (mirrors what LedgerRepository.postEntry persists) ----
const balances = new Map<string, { debit: bigint; credit: bigint }>();
const journal: JournalEntryDraftData[] = [];

function ref(code: AccountCode): AccountRef {
  return { code, landlordId: 'demo-landlord', tenancyId: 'demo-tenancy' };
}

function post(draft: JournalEntryDraftData): void {
  journal.push(draft);
  for (const p of draft.postings) {
    const cur = balances.get(p.account.code) ?? { debit: 0n, credit: 0n };
    if (p.side === 'DEBIT') cur.debit += p.amount.amountMinor;
    else cur.credit += p.amount.amountMinor;
    balances.set(p.account.code, cur);
  }
}

function entry(entryType: LedgerEntryType, occurredAt: Date): JournalEntryDraft {
  return new JournalEntryDraft({ entryType, occurredAt, currency: CUR, landlordId: 'demo-landlord', tenancyId: 'demo-tenancy' });
}

function balanceOf(code: AccountCode): bigint {
  const b = balances.get(code) ?? { debit: 0n, credit: 0n };
  return signedBalanceMinor(code, b.debit, b.credit);
}

function h(title: string): void {
  console.log(`\n\x1b[1m\x1b[31m${title}\x1b[0m`);
}

// ---- the demo tenancy ----
const policy = resolvePolicy([INDIA_DEFAULT_POLICY], 'IN', d('2025-06-01'));
const rent = inr(5_500_000); // ₹55,000 / month
const deposit = inr(5_500_000); // ₹55,000
const escalation: EscalationSchedule = {
  type: 'PERCENT',
  rateBps: 1000, // 10% / year
  frequencyMonths: 12,
  startDate: d('2025-06-01'),
  compounding: true,
};

console.log('\x1b[1m════════════════════════════════════════════════════════════');
console.log(' RentLedger — engine demo (no database)');
console.log('════════════════════════════════════════════════════════════\x1b[0m');
console.log(`Tenancy: rent ${fmt(rent)}/mo · deposit ${fmt(deposit)} · 10% annual escalation`);
console.log(`Jurisdiction: ${policy.jurisdiction} (reviewedByCounsel=${policy.reviewedByCounsel}) · proration basis ${policy.proration.basis}`);

// arrears tracking
interface Invoice { label: string; due: string; amount: Money; paid: bigint }
const invoices: Invoice[] = [];

// 1) Deposit collected
h('1. Collect security deposit');
post(entry(LedgerEntryType.DEPOSIT_COLLECTION, d('2025-06-01')).debit(ref(AccountCode.CASH), deposit).credit(ref(AccountCode.SECURITY_DEPOSIT_LIABILITY), deposit).build());
console.log(`  CASH +${fmt(deposit)}  →  SECURITY_DEPOSIT_LIABILITY ${fmt(deposit)} (held)`);

// 2) June 2025 rent invoice (full month, no escalation yet)
h('2. Invoice June 2025 rent');
const junEsc = escalatedRent(rent, escalation, d('2025-06-01'));
const junPro = prorateRent({ monthlyRent: junEsc.rent, periodStart: d('2025-06-01'), periodEnd: d('2025-06-30'), basis: policy.proration.basis });
console.log(`  escalation periods applied: ${junEsc.periodsApplied} → rent ${fmt(junEsc.rent)}`);
console.log(`  proration: ${junPro.chargeableDays}/${junPro.totalDays} days → ${fmt(junPro.amount)}`);
post(entry(LedgerEntryType.INVOICE, d('2025-06-01')).debit(ref(AccountCode.RENT_RECEIVABLE), junPro.amount).credit(ref(AccountCode.RENT_INCOME), junPro.amount).build());
invoices.push({ label: 'Jun 2025', due: '2025-06-05', amount: junPro.amount, paid: 0n });

// 3) Pay June in full
h('3. Tenant pays June in full (UPI ₹55,000)');
post(entry(LedgerEntryType.PAYMENT, d('2025-06-04')).debit(ref(AccountCode.CASH), inr(5_500_000)).credit(ref(AccountCode.RENT_RECEIVABLE), inr(5_500_000)).build());
invoices[0].paid = 5_500_000n;
console.log(`  CASH +${fmt(inr(5_500_000))}  →  settles RENT_RECEIVABLE`);

// 4) July 2025 invoice + partial payment
h('4. Invoice July 2025, tenant pays partial ₹30,000');
post(entry(LedgerEntryType.INVOICE, d('2025-07-01')).debit(ref(AccountCode.RENT_RECEIVABLE), rent).credit(ref(AccountCode.RENT_INCOME), rent).build());
invoices.push({ label: 'Jul 2025', due: '2025-07-05', amount: rent, paid: 0n });
post(entry(LedgerEntryType.PAYMENT, d('2025-07-06')).debit(ref(AccountCode.CASH), inr(3_000_000)).credit(ref(AccountCode.RENT_RECEIVABLE), inr(3_000_000)).build());
invoices[1].paid = 3_000_000n;
console.log(`  invoiced ${fmt(rent)}, paid ${fmt(inr(3_000_000))} → outstanding ${fmt(inr(2_500_000))}`);

// 5) Late fee on the overdue July invoice
h('5. Late fee on overdue July invoice (as of 2025-07-20)');
const lf = computeLateFee({ outstanding: inr(2_500_000), policy: policy.lateFee, dueDate: d('2025-07-05'), asOf: d('2025-07-20') });
console.log(`  ${lf.daysLate} days late, grace ${policy.lateFee.graceDays} → ${lf.chargeableDays} chargeable × ₹50/day = ${fmt(lf.fee)}`);
if (lf.applied) {
  post(entry(LedgerEntryType.LATE_FEE, d('2025-07-20')).debit(ref(AccountCode.LATE_FEE_RECEIVABLE), lf.fee).credit(ref(AccountCode.LATE_FEE_INCOME), lf.fee).build());
  invoices.push({ label: 'Late fee Jul', due: '2025-07-20', amount: lf.fee, paid: 0n });
}

// 6) June 2026 invoice — escalated 10%
h('6. Invoice June 2026 rent (escalation kicks in)');
const jun26 = escalatedRent(rent, escalation, d('2026-06-01'));
console.log(`  escalation periods applied: ${jun26.periodsApplied} → rent ${fmt(jun26.rent)} (was ${fmt(rent)})`);
post(entry(LedgerEntryType.INVOICE, d('2026-06-01')).debit(ref(AccountCode.RENT_RECEIVABLE), jun26.rent).credit(ref(AccountCode.RENT_INCOME), jun26.rent).build());
invoices.push({ label: 'Jun 2026', due: '2026-06-05', amount: jun26.rent, paid: 0n });

// 7) Overpayment → advance rolls forward
h('7. Tenant overpays June 2026 (₹70,000) → advance rolls forward');
const cash = inr(7_000_000);
const settle = jun26.rent; // 60,500
const advance = cash.subtract(settle); // 9,500
post(
  entry(LedgerEntryType.PAYMENT, d('2026-06-03'))
    .debit(ref(AccountCode.CASH), cash)
    .credit(ref(AccountCode.RENT_RECEIVABLE), settle)
    .credit(ref(AccountCode.TENANT_ADVANCE), advance)
    .build(),
);
invoices[invoices.length - 1].paid = settle.amountMinor;
console.log(`  paid ${fmt(cash)} → ${fmt(settle)} settles invoice, ${fmt(advance)} → TENANT_ADVANCE`);

// 8) TDS preview (194-IB), with the 2026 section-code switch
h('8. TDS determination (Section 194-IB)');
const annual = rent.multiplyInt(12);
for (const asOf of ['2026-03-31', '2026-04-01']) {
  const t = determineTds({ payerClass: 'INDIVIDUAL_HUF', monthlyRent: rent, annualRent: annual, landlordPanValid: true, policy, asOf: d(asOf) });
  console.log(`  as of ${asOf}: ${t.applicable ? `§${t.section} · ${(t.rateBps ?? 0) / 100}% of ${fmt(t.base!)} = ${fmt(t.amount!)} (forms ${t.returnForm}/${t.certificateForm})` : t.reason}`);
}
const tNoPan = determineTds({ payerClass: 'INDIVIDUAL_HUF', monthlyRent: rent, annualRent: annual, landlordPanValid: false, policy, asOf: d('2026-03-31') });
console.log(`  if landlord PAN missing: ${(tNoPan.rateBps ?? 0) / 100}% → ${fmt(tNoPan.amount!)}`);

// 9) Final ledger balances
h('9. Ledger balances (computed from postings, signed by normal side)');
const order: AccountCode[] = [
  AccountCode.CASH,
  AccountCode.RENT_RECEIVABLE,
  AccountCode.RENT_INCOME,
  AccountCode.LATE_FEE_RECEIVABLE,
  AccountCode.LATE_FEE_INCOME,
  AccountCode.TENANT_ADVANCE,
  AccountCode.SECURITY_DEPOSIT_LIABILITY,
];
for (const code of order) {
  if (!balances.has(code)) continue;
  console.log(`  ${code.padEnd(28)} ${fmtMinor(balanceOf(code)).padStart(14)}`);
}

// 10) Arrears ageing as of 2026-06-20
h('10. Arrears ageing as of 2026-06-20');
const asOf = d('2026-06-20');
const buckets = { '0-30': 0n, '31-60': 0n, '61-90': 0n, '90+': 0n };
for (const inv of invoices) {
  const outstanding = inv.amount.amountMinor - inv.paid;
  if (outstanding <= 0n) continue;
  const age = Math.floor((asOf.getTime() - d(inv.due).getTime()) / 86_400_000);
  const key = age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+';
  buckets[key] += outstanding;
  console.log(`  ${inv.label.padEnd(14)} due ${inv.due}  outstanding ${fmtMinor(outstanding).padStart(12)}  (${age}d → ${key})`);
}
console.log(`  buckets:`, Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, fmtMinor(v)])));

// 11) Integrity check
h('11. Double-entry integrity');
let totalDebit = 0n;
let totalCredit = 0n;
for (const b of balances.values()) {
  totalDebit += b.debit;
  totalCredit += b.credit;
}
console.log(`  ${journal.length} journal entries · Σdebits ${fmtMinor(totalDebit)} · Σcredits ${fmtMinor(totalCredit)}`);
console.log(totalDebit === totalCredit ? '  \x1b[32m✓ ledger is balanced\x1b[0m' : '  \x1b[31m✗ UNBALANCED\x1b[0m');
console.log('');
