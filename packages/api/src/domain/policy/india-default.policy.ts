import { JurisdictionPolicy } from './jurisdiction-policy';

/**
 * India default policy (shipped seed). Values reflect commonly-cited defaults and
 * MUST be reviewed by counsel before production use — hence reviewedByCounsel:false.
 *
 *  - TDS 194-IB: individuals/HUF paying rent > ₹50,000/month deduct 2% (20% if the
 *    landlord PAN is missing) once on the year's rent, file Form 26QC within 30
 *    days of month-end, issue Form 16C.
 *  - TDS 194-I: companies/firms/audited payers deduct 10% on building rent above an
 *    annual threshold of ₹2,40,000, each payment.
 *  - Income-tax Act 2025 consolidates these into Section 393 from 1 Apr 2026; the
 *    legacy codes are kept and mapped by date.
 *  - Registration triggered for terms > 11 months; default template term 11 months.
 *  - Residential deposit capped at 2 months' rent (Model Tenancy Act).
 */
export const INDIA_DEFAULT_POLICY: JurisdictionPolicy = {
  jurisdiction: 'IN',
  version: 1,
  effectiveFrom: '2020-04-01',
  effectiveTo: null,
  currency: 'INR',
  locale: 'en-IN',
  reviewedByCounsel: false,
  disclaimer:
    'RentLedger generates documents and computes statutory figures from configurable policy data. It is not legal or tax advice; templates, rates and thresholds require review by qualified counsel for the applicable jurisdiction.',
  proration: { basis: 'ACTUAL_DAYS_IN_PERIOD' },
  lateFee: {
    graceDays: 5,
    type: 'PER_DAY',
    valueMinor: '5000', // ₹50 per day after grace
    maxCapMinor: null,
  },
  deposit: {
    maxMonthsOfRent: 2,
    interestMandated: false,
  },
  registration: {
    registrationRequiredAboveMonths: 11,
    defaultTermMonths: 11,
    rentAuthorityFilingDays: 60,
  },
  noticePeriods: {
    terminationDays: 30,
    rentIncreaseDays: 30,
    paymentDefaultDays: 15,
  },
  tds: [
    {
      legacySection: '194IB',
      consolidatedSection: '393',
      consolidatedFrom: '2026-04-01',
      payerClasses: ['INDIVIDUAL_HUF'],
      thresholdBasis: 'MONTHLY',
      thresholdMinor: '5000000', // ₹50,000 / month
      rateBps: 200, // 2%
      panMissingRateBps: 2000, // 20%
      deductionTiming: 'LAST_MONTH',
      returnForm: '26QC',
      certificateForm: '16C',
      filingDueDays: 30,
    },
    {
      legacySection: '194I',
      consolidatedSection: '393',
      consolidatedFrom: '2026-04-01',
      payerClasses: ['COMPANY_FIRM_AUDITED'],
      thresholdBasis: 'ANNUAL',
      thresholdMinor: '24000000', // ₹2,40,000 / year
      rateBps: 1000, // 10% on building/land rent
      panMissingRateBps: 2000, // 20%
      deductionTiming: 'EACH_PAYMENT',
      returnForm: '26Q',
      certificateForm: '16A',
      filingDueDays: 7,
    },
  ],
};

/** The set of policies seeded by default. Add jurisdictions here (or via the DB). */
export const DEFAULT_POLICIES: JurisdictionPolicy[] = [INDIA_DEFAULT_POLICY];
