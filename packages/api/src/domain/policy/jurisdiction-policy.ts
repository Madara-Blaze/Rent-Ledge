/**
 * JurisdictionPolicy — the versioned, effective-dated data that drives every
 * legal/tax calculation. The spec is emphatic: rules (TDS rates, deposit caps,
 * notice periods, registration triggers, late-fee defaults) must be *data*, keyed
 * by jurisdiction and effective date, never hardcoded in business logic. Adding a
 * new jurisdiction (or amending one from a given date) is a data change.
 *
 * Money values are stored as base-10 strings of minor units so a policy is plain
 * JSON that round-trips cleanly through the database and API.
 */

export type PayerClass = 'INDIVIDUAL_HUF' | 'COMPANY_FIRM_AUDITED' | 'OTHER';

export type ProrationBasis = 'ACTUAL_DAYS_IN_PERIOD' | 'THIRTY_DAY_MONTH';

export type LateFeeType = 'FLAT' | 'PERCENT' | 'PER_DAY';

export interface TdsRule {
  /** Legacy Income-tax Act section, e.g. '194IB' or '194I'. */
  legacySection: string;
  /** Income-tax Act 2025 consolidated section (e.g. '393'). */
  consolidatedSection?: string;
  /** ISO date (YYYY-MM-DD) from which the consolidated section applies. */
  consolidatedFrom?: string;
  /** Which payer classes this rule applies to. */
  payerClasses: PayerClass[];
  /** Whether the *threshold* is tested per month or per year. */
  thresholdBasis: 'MONTHLY' | 'ANNUAL';
  /** Threshold in minor units (string). TDS applies only above this. */
  thresholdMinor: string;
  /** Normal deduction rate in basis points (200 = 2%). */
  rateBps: number;
  /** Higher rate when the landlord's PAN is missing/invalid (2000 = 20%). */
  panMissingRateBps: number;
  /**
   * LAST_MONTH  → deducted once on the whole year's rent (e.g. 194-IB).
   * EACH_PAYMENT→ deducted on every month's rent (e.g. 194-I).
   * This also decides the base: annual vs monthly.
   */
  deductionTiming: 'LAST_MONTH' | 'EACH_PAYMENT';
  returnForm: string; // '26QC'
  certificateForm: string; // '16C'
  /** Days after the end of the deduction month to file the return. */
  filingDueDays: number;
}

export interface LateFeePolicy {
  graceDays: number;
  type: LateFeeType;
  /** FLAT / PER_DAY amount in minor units (string). */
  valueMinor?: string;
  /** PERCENT rate in basis points. */
  rateBps?: number;
  /** Optional cap in minor units (string). */
  maxCapMinor?: string | null;
}

export interface DepositPolicy {
  /** Statutory cap as a multiple of monthly rent (e.g. 2 for residential MTA). */
  maxMonthsOfRent: number;
  interestMandated: boolean;
  interestRateBps?: number;
}

export interface RegistrationPolicy {
  /** Terms strictly greater than this many months trigger registration. */
  registrationRequiredAboveMonths: number;
  defaultTermMonths: number;
  /** Days to file with the Rent Authority in MTA-adopting states. */
  rentAuthorityFilingDays?: number;
}

export interface NoticePeriodPolicy {
  terminationDays: number;
  rentIncreaseDays: number;
  paymentDefaultDays: number;
}

export interface JurisdictionPolicy {
  jurisdiction: string; // 'IN', 'IN-MH', ...
  version: number;
  effectiveFrom: string; // ISO date (YYYY-MM-DD)
  effectiveTo?: string | null; // exclusive upper bound, null = open-ended
  currency: string;
  locale: string;
  reviewedByCounsel: boolean;
  disclaimer: string;
  proration: { basis: ProrationBasis };
  lateFee: LateFeePolicy;
  deposit: DepositPolicy;
  registration: RegistrationPolicy;
  noticePeriods: NoticePeriodPolicy;
  tds: TdsRule[];
}

export class PolicyNotFoundError extends Error {
  constructor(jurisdiction: string, onDate: string) {
    super(`No active jurisdiction policy for "${jurisdiction}" effective on ${onDate}`);
    this.name = 'PolicyNotFoundError';
  }
}

/** UTC YYYY-MM-DD for a Date (date-only comparisons are lexicographic-safe). */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pick the policy version in force for a jurisdiction on a given date. When more
 * than one matches, the highest version wins (later amendment supersedes).
 */
export function resolvePolicy(
  policies: JurisdictionPolicy[],
  jurisdiction: string,
  onDate: Date,
): JurisdictionPolicy {
  const on = isoDate(onDate);
  const matches = policies
    .filter(
      (p) =>
        p.jurisdiction === jurisdiction &&
        p.effectiveFrom <= on &&
        (p.effectiveTo == null || on < p.effectiveTo),
    )
    .sort((a, b) => b.version - a.version);

  if (matches.length === 0) throw new PolicyNotFoundError(jurisdiction, on);
  return matches[0];
}

export function tdsRuleFor(policy: JurisdictionPolicy, payerClass: PayerClass): TdsRule | undefined {
  return policy.tds.find((r) => r.payerClasses.includes(payerClass));
}

/**
 * Resolve the section code to print on challans/returns for a given date,
 * honouring the Income-tax Act 2025 → Section 393 consolidation (1 Apr 2026).
 */
export function effectiveTdsSection(rule: TdsRule, onDate: Date): string {
  if (rule.consolidatedSection && rule.consolidatedFrom && isoDate(onDate) >= rule.consolidatedFrom) {
    return rule.consolidatedSection;
  }
  return rule.legacySection;
}
