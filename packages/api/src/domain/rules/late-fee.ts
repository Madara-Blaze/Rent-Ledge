import { Money } from '../money/money';
import { LateFeePolicy } from '../policy/jurisdiction-policy';
import { daysBetween } from './dates';

export interface LateFeeInput {
  outstanding: Money;
  policy: LateFeePolicy;
  /** Invoice due date. */
  dueDate: Date;
  /** Evaluation date (today, or a preview date). */
  asOf: Date;
}

export interface LateFeeResult {
  fee: Money;
  daysLate: number;
  /** Late days that actually attract a charge (after the grace window). */
  chargeableDays: number;
  withinGrace: boolean;
  applied: boolean;
}

/**
 * Compute a late fee from policy: a grace window, then FLAT / PERCENT-of-
 * outstanding / PER_DAY, optionally capped. No fee while within grace, or when
 * nothing is outstanding.
 */
export function computeLateFee(input: LateFeeInput): LateFeeResult {
  const { outstanding, policy, dueDate, asOf } = input;
  const currency = outstanding.currency;

  const daysLate = Math.max(0, daysBetween(dueDate, asOf));
  const withinGrace = daysLate <= policy.graceDays;
  const chargeableDays = Math.max(0, daysLate - policy.graceDays);

  if (!outstanding.isPositive() || withinGrace) {
    return { fee: Money.zero(currency), daysLate, chargeableDays, withinGrace, applied: false };
  }

  let fee: Money;
  switch (policy.type) {
    case 'FLAT':
      fee = Money.of(policy.valueMinor ?? '0', currency);
      break;
    case 'PERCENT':
      fee = outstanding.percentageBps(policy.rateBps ?? 0);
      break;
    case 'PER_DAY':
      fee = Money.of(policy.valueMinor ?? '0', currency).multiplyInt(chargeableDays);
      break;
  }

  if (policy.maxCapMinor != null) {
    fee = fee.min(Money.of(policy.maxCapMinor, currency));
  }

  return { fee, daysLate, chargeableDays, withinGrace, applied: fee.isPositive() };
}
