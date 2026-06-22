import { Money } from '../money/money';
import { monthsBetween } from './dates';

export type EscalationType = 'PERCENT' | 'AMOUNT';

export interface EscalationSchedule {
  type: EscalationType;
  /** PERCENT: basis points applied per period (e.g. 1000 = 10%). */
  rateBps?: number;
  /** AMOUNT: minor units added per period (string). */
  amountMinor?: string;
  /** Period length in months (12 = annual hike). */
  frequencyMonths: number;
  /** Baseline date from which anniversaries are counted (usually tenancy start). */
  startDate: Date;
  /** PERCENT only — compound each period over the previous rent (default true). */
  compounding?: boolean;
  /** Optional ceiling in minor units (string). */
  maxRentMinor?: string | null;
}

export interface EscalationResult {
  rent: Money;
  periodsApplied: number;
  baseRent: Money;
}

/**
 * Compute the rent in force as-of a date given a scheduled escalation clause.
 * Compounded percentage rounds each period (matching how a real lease would be
 * billed period-by-period), which is why we iterate rather than use pow().
 */
export function escalatedRent(
  baseRent: Money,
  schedule: EscalationSchedule,
  asOf: Date,
): EscalationResult {
  const elapsedMonths = monthsBetween(schedule.startDate, asOf);
  const periods = elapsedMonths <= 0 ? 0 : Math.floor(elapsedMonths / schedule.frequencyMonths);

  let rent = baseRent;
  if (periods > 0) {
    if (schedule.type === 'PERCENT') {
      const bps = schedule.rateBps ?? 0;
      if (schedule.compounding === false) {
        rent = baseRent.add(baseRent.percentageBps(bps).multiplyInt(periods));
      } else {
        for (let i = 0; i < periods; i++) {
          rent = rent.add(rent.percentageBps(bps));
        }
      }
    } else {
      const step = Money.of(schedule.amountMinor ?? '0', baseRent.currency);
      rent = baseRent.add(step.multiplyInt(periods));
    }
  }

  if (schedule.maxRentMinor != null) {
    const cap = Money.of(schedule.maxRentMinor, baseRent.currency);
    rent = rent.min(cap);
  }

  return { rent, periodsApplied: periods, baseRent };
}
