import { Money } from '../money/money';
import {
  JurisdictionPolicy,
  PayerClass,
  effectiveTdsSection,
  tdsRuleFor,
} from '../policy/jurisdiction-policy';

export interface TdsInput {
  payerClass: PayerClass;
  /** Rent per month (excluding GST), for monthly-threshold tests / per-payment base. */
  monthlyRent: Money;
  /** Total rent for the financial year / tenancy (excluding GST), for annual base. */
  annualRent: Money;
  /** Whether the landlord's PAN is present and valid. Drives the 20% surcharge. */
  landlordPanValid: boolean;
  /** Separately-stated GST included in the rent figures, excluded from the TDS base. */
  gstComponent?: Money;
  /** Genuinely refundable security deposit — NOT subject to TDS (informational). */
  refundableDeposit?: Money;
  policy: JurisdictionPolicy;
  /** Date the deduction relates to (for section-code mapping). */
  asOf: Date;
}

export interface TdsResult {
  applicable: boolean;
  reason: string;
  section?: string;
  legacySection?: string;
  rateBps?: number;
  panSurchargeApplied?: boolean;
  base?: Money;
  amount?: Money;
  returnForm?: string;
  certificateForm?: string;
  filingDueDays?: number;
  deductionTiming?: 'LAST_MONTH' | 'EACH_PAYMENT';
  /** Deposit excluded from the base, surfaced for the preview/breakdown. */
  excludedRefundableDeposit?: Money;
}

/**
 * Determine TDS on rent from policy. Pure and total — it never throws on the
 * not-applicable path, returning a `reason` instead, so it doubles as a preview.
 *
 * Base rules (encoded by deductionTiming, matching Indian practice):
 *  - LAST_MONTH  (194-IB): threshold tested per month; base is the *annual* rent.
 *  - EACH_PAYMENT(194-I) : threshold tested per year;  base is the *monthly* rent.
 * GST is excluded from the base; a refundable deposit is never part of the base.
 */
export function determineTds(input: TdsInput): TdsResult {
  const { policy, payerClass, monthlyRent, annualRent, asOf } = input;
  const currency = policy.currency;

  const rule = tdsRuleFor(policy, payerClass);
  if (!rule) {
    return { applicable: false, reason: `No TDS rule for payer class ${payerClass} in ${policy.jurisdiction}` };
  }

  const threshold = Money.of(rule.thresholdMinor, currency);
  const measure = rule.thresholdBasis === 'MONTHLY' ? monthlyRent : annualRent;
  if (measure.lessThanOrEqual(threshold)) {
    return {
      applicable: false,
      reason: `${rule.thresholdBasis.toLowerCase()} rent ${measure.format(policy.locale)} is at/below the ${rule.legacySection} threshold ${threshold.format(policy.locale)}`,
    };
  }

  // Base: annual for last-month deduction, monthly for per-payment deduction.
  let base = rule.deductionTiming === 'LAST_MONTH' ? annualRent : monthlyRent;
  if (input.gstComponent && input.gstComponent.isPositive()) {
    base = base.subtract(input.gstComponent);
    if (base.isNegative()) base = Money.zero(currency);
  }

  const panSurchargeApplied = !input.landlordPanValid;
  const rateBps = panSurchargeApplied ? rule.panMissingRateBps : rule.rateBps;
  const amount = base.percentageBps(rateBps);

  return {
    applicable: true,
    reason: `${rule.legacySection}: ${rateBps / 100}% on ${base.format(policy.locale)}${panSurchargeApplied ? ' (PAN missing → higher rate)' : ''}`,
    section: effectiveTdsSection(rule, asOf),
    legacySection: rule.legacySection,
    rateBps,
    panSurchargeApplied,
    base,
    amount,
    returnForm: rule.returnForm,
    certificateForm: rule.certificateForm,
    filingDueDays: rule.filingDueDays,
    deductionTiming: rule.deductionTiming,
    excludedRefundableDeposit: input.refundableDeposit,
  };
}
