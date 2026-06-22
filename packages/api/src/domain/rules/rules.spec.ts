import { describe, expect, it } from 'vitest';
import { Money } from '../money/money';
import { INDIA_DEFAULT_POLICY } from '../policy/india-default.policy';
import { resolvePolicy } from '../policy/jurisdiction-policy';
import { escalatedRent } from './escalation';
import { computeLateFee } from './late-fee';
import { prorateRent } from './proration';
import { determineTds } from './tds';

const inr = (minor: number) => Money.of(minor, 'INR');
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const policy = INDIA_DEFAULT_POLICY;

describe('proration', () => {
  it('charges full rent for a fully-occupied month', () => {
    const r = prorateRent({
      monthlyRent: inr(2_000_000),
      periodStart: d('2026-06-01'),
      periodEnd: d('2026-06-30'),
      basis: 'ACTUAL_DAYS_IN_PERIOD',
    });
    expect(r.totalDays).toBe(30);
    expect(r.amount.amountMinor).toBe(2_000_000n);
  });

  it('prorates a mid-month move-in (15 of 30 days)', () => {
    const r = prorateRent({
      monthlyRent: inr(2_000_000),
      periodStart: d('2026-06-01'),
      periodEnd: d('2026-06-30'),
      occupancyStart: d('2026-06-16'),
      basis: 'ACTUAL_DAYS_IN_PERIOD',
    });
    expect(r.chargeableDays).toBe(15);
    expect(r.amount.amountMinor).toBe(1_000_000n);
  });

  it('supports the 30-day-month convention', () => {
    const r = prorateRent({
      monthlyRent: inr(2_000_000),
      periodStart: d('2026-02-01'),
      periodEnd: d('2026-02-28'),
      occupancyStart: d('2026-02-15'),
      basis: 'THIRTY_DAY_MONTH',
    });
    expect(r.totalDays).toBe(30);
    expect(r.chargeableDays).toBe(14); // Feb 15..28 inclusive
    expect(r.amount.amountMinor).toBe(933_333n); // 2,000,000 * 14/30
  });
});

describe('escalation', () => {
  const schedule = (over: Partial<Parameters<typeof escalatedRent>[1]> = {}) => ({
    type: 'PERCENT' as const,
    rateBps: 1000, // 10%
    frequencyMonths: 12,
    startDate: d('2024-06-01'),
    ...over,
  });

  it('returns base rent before the first anniversary', () => {
    expect(escalatedRent(inr(2_000_000), schedule(), d('2025-05-31')).rent.amountMinor).toBe(2_000_000n);
  });

  it('applies a 10% hike after one year', () => {
    const r = escalatedRent(inr(2_000_000), schedule(), d('2025-06-01'));
    expect(r.periodsApplied).toBe(1);
    expect(r.rent.amountMinor).toBe(2_200_000n);
  });

  it('compounds over two years by default', () => {
    const r = escalatedRent(inr(2_000_000), schedule(), d('2026-06-01'));
    expect(r.periodsApplied).toBe(2);
    expect(r.rent.amountMinor).toBe(2_420_000n); // 2,000,000 -> 2,200,000 -> 2,420,000
  });

  it('supports simple (non-compounding) percentage', () => {
    const r = escalatedRent(inr(2_000_000), schedule({ compounding: false }), d('2026-06-01'));
    expect(r.rent.amountMinor).toBe(2_400_000n); // base + 2 * 10%
  });

  it('supports fixed-amount escalation with a cap', () => {
    const r = escalatedRent(
      inr(2_000_000),
      { type: 'AMOUNT', amountMinor: '100000', frequencyMonths: 12, startDate: d('2024-06-01'), maxRentMinor: '2150000' },
      d('2027-06-01'),
    );
    // base + 3 * 1,000 = 2,300,000, capped at 2,150,000
    expect(r.rent.amountMinor).toBe(2_150_000n);
  });
});

describe('late fee', () => {
  it('charges nothing within the grace window', () => {
    const r = computeLateFee({
      outstanding: inr(2_000_000),
      policy: policy.lateFee,
      dueDate: d('2026-06-05'),
      asOf: d('2026-06-09'), // 4 days late, grace 5
    });
    expect(r.withinGrace).toBe(true);
    expect(r.fee.isZero()).toBe(true);
  });

  it('charges per-day after grace', () => {
    const r = computeLateFee({
      outstanding: inr(2_000_000),
      policy: policy.lateFee, // ₹50/day, grace 5
      dueDate: d('2026-06-05'),
      asOf: d('2026-06-12'), // 7 days late -> 2 chargeable days
    });
    expect(r.daysLate).toBe(7);
    expect(r.chargeableDays).toBe(2);
    expect(r.fee.amountMinor).toBe(10_000n); // ₹100
    expect(r.applied).toBe(true);
  });

  it('charges nothing when there is no outstanding balance', () => {
    const r = computeLateFee({
      outstanding: inr(0),
      policy: policy.lateFee,
      dueDate: d('2026-06-05'),
      asOf: d('2026-07-05'),
    });
    expect(r.fee.isZero()).toBe(true);
  });

  it('respects a percentage type with a cap', () => {
    const r = computeLateFee({
      outstanding: inr(2_000_000),
      policy: { graceDays: 0, type: 'PERCENT', rateBps: 500, maxCapMinor: '50000' },
      dueDate: d('2026-06-05'),
      asOf: d('2026-06-10'),
    });
    // 5% of 2,000,000 = 100,000, capped at 50,000
    expect(r.fee.amountMinor).toBe(50_000n);
  });
});

describe('TDS — 194-IB (individual/HUF)', () => {
  const base194ib = {
    payerClass: 'INDIVIDUAL_HUF' as const,
    monthlyRent: inr(6_000_000), // ₹60,000 > ₹50,000 threshold
    annualRent: inr(72_000_000), // ₹7,20,000
    landlordPanValid: true,
    policy,
    asOf: d('2025-06-01'),
  };

  it('deducts 2% on the annual rent when PAN is valid', () => {
    const r = determineTds(base194ib);
    expect(r.applicable).toBe(true);
    expect(r.legacySection).toBe('194IB');
    expect(r.section).toBe('194IB'); // before 1 Apr 2026
    expect(r.rateBps).toBe(200);
    expect(r.amount!.amountMinor).toBe(1_440_000n); // 2% of 72,00,000
    expect(r.returnForm).toBe('26QC');
    expect(r.certificateForm).toBe('16C');
  });

  it('deducts 20% when the landlord PAN is missing/invalid', () => {
    const r = determineTds({ ...base194ib, landlordPanValid: false });
    expect(r.panSurchargeApplied).toBe(true);
    expect(r.rateBps).toBe(2000);
    expect(r.amount!.amountMinor).toBe(14_400_000n); // 20% of 72,00,000
  });

  it('does not apply below the monthly threshold', () => {
    const r = determineTds({ ...base194ib, monthlyRent: inr(4_000_000) }); // ₹40,000
    expect(r.applicable).toBe(false);
  });

  it('maps to consolidated Section 393 from 1 Apr 2026', () => {
    expect(determineTds({ ...base194ib, asOf: d('2026-03-31') }).section).toBe('194IB');
    expect(determineTds({ ...base194ib, asOf: d('2026-04-01') }).section).toBe('393');
  });

  it('excludes separately-stated GST from the base', () => {
    const r = determineTds({ ...base194ib, gstComponent: inr(2_000_000) });
    expect(r.base!.amountMinor).toBe(70_000_000n); // 72,00,000 - 2,00,000... (paise)
    expect(r.amount!.amountMinor).toBe(1_400_000n);
  });

  it('never includes a refundable deposit in the base', () => {
    const withDeposit = determineTds({ ...base194ib, refundableDeposit: inr(12_000_000) });
    const withoutDeposit = determineTds(base194ib);
    expect(withDeposit.amount!.amountMinor).toBe(withoutDeposit.amount!.amountMinor);
    expect(withDeposit.excludedRefundableDeposit!.amountMinor).toBe(12_000_000n);
  });
});

describe('TDS — 194-I (company/firm/audited)', () => {
  it('deducts 10% on each monthly payment above the annual threshold', () => {
    const r = determineTds({
      payerClass: 'COMPANY_FIRM_AUDITED',
      monthlyRent: inr(2_500_000), // ₹25,000/month
      annualRent: inr(30_000_000), // ₹3,00,000 > ₹2,40,000
      landlordPanValid: true,
      policy,
      asOf: d('2025-06-01'),
    });
    expect(r.applicable).toBe(true);
    expect(r.legacySection).toBe('194I');
    expect(r.rateBps).toBe(1000);
    expect(r.deductionTiming).toBe('EACH_PAYMENT');
    expect(r.base!.amountMinor).toBe(2_500_000n); // monthly base
    expect(r.amount!.amountMinor).toBe(250_000n); // 10% of ₹25,000
  });
});

describe('policy resolution', () => {
  it('resolves the active India policy by date', () => {
    const p = resolvePolicy([policy], 'IN', d('2026-06-20'));
    expect(p.jurisdiction).toBe('IN');
    expect(p.version).toBe(1);
  });
});
