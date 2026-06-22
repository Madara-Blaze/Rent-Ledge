import { Money } from '../money/money';
import { ProrationBasis } from '../policy/jurisdiction-policy';
import { daysInclusive, maxDate, minDate } from './dates';

export interface ProrationInput {
  monthlyRent: Money;
  /** Billing period, inclusive of both ends (e.g. 1st..30th). */
  periodStart: Date;
  periodEnd: Date;
  /** Defaults to periodStart/periodEnd when the tenant occupies the whole period. */
  occupancyStart?: Date;
  occupancyEnd?: Date;
  basis: ProrationBasis;
}

export interface ProrationResult {
  amount: Money;
  chargeableDays: number;
  totalDays: number;
  basis: ProrationBasis;
}

/**
 * Prorate rent for a partial first/last month. With ACTUAL_DAYS_IN_PERIOD the
 * denominator is the real number of days in the billing period; with
 * THIRTY_DAY_MONTH it is a fixed 30 (the "thirtieth" convention some leases use).
 * A full period returns the exact monthly rent (no rounding drift).
 */
export function prorateRent(input: ProrationInput): ProrationResult {
  const { monthlyRent, periodStart, periodEnd, basis } = input;

  const totalDays =
    basis === 'THIRTY_DAY_MONTH' ? 30 : daysInclusive(periodStart, periodEnd);

  const occStart = maxDate(input.occupancyStart ?? periodStart, periodStart);
  const occEnd = minDate(input.occupancyEnd ?? periodEnd, periodEnd);

  let chargeableDays = occEnd.getTime() >= occStart.getTime() ? daysInclusive(occStart, occEnd) : 0;
  if (chargeableDays > totalDays) chargeableDays = totalDays;

  const amount =
    chargeableDays >= totalDays ? monthlyRent : monthlyRent.mulDivRound(chargeableDays, totalDays);

  return { amount, chargeableDays, totalDays, basis };
}
