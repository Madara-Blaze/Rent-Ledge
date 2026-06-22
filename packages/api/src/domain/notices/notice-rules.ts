import { JurisdictionPolicy } from '../policy/jurisdiction-policy';
import { daysBetween } from '../rules/dates';

export type NoticeType =
  | 'RENT_REMINDER'
  | 'PAYMENT_DEFAULT'
  | 'RENT_INCREASE'
  | 'RENEWAL_OFFER'
  | 'TERMINATION'
  | 'DEPOSIT_DEDUCTION'
  | 'EVICTION';

export const NOTICE_TYPES: NoticeType[] = [
  'RENT_REMINDER',
  'PAYMENT_DEFAULT',
  'RENT_INCREASE',
  'RENEWAL_OFFER',
  'TERMINATION',
  'DEPOSIT_DEDUCTION',
  'EVICTION',
];

/** Statutory minimum notice days for a notice type, from jurisdiction policy. */
export function minNoticeDaysFor(type: NoticeType, policy: JurisdictionPolicy): number {
  switch (type) {
    case 'TERMINATION':
    case 'EVICTION':
      return policy.noticePeriods.terminationDays;
    case 'RENT_INCREASE':
    case 'RENEWAL_OFFER':
      return policy.noticePeriods.rentIncreaseDays;
    case 'PAYMENT_DEFAULT':
      return policy.noticePeriods.paymentDefaultDays;
    default:
      return 0;
  }
}

export interface NoticeCheck {
  allowed: boolean;
  minNoticeDays: number;
  daysGiven: number;
  reason: string;
}

/** Enforce the minimum notice window before an action's effective date. */
export function checkNoticePeriod(
  type: NoticeType,
  policy: JurisdictionPolicy,
  sentDate: Date,
  effectiveDate?: Date,
): NoticeCheck {
  const minNoticeDays = minNoticeDaysFor(type, policy);
  if (minNoticeDays === 0) {
    return { allowed: true, minNoticeDays, daysGiven: 0, reason: 'No statutory notice period for this notice type' };
  }
  if (!effectiveDate) {
    return { allowed: false, minNoticeDays, daysGiven: 0, reason: `An effective date is required (needs ${minNoticeDays} days notice)` };
  }
  const daysGiven = daysBetween(sentDate, effectiveDate);
  const allowed = daysGiven >= minNoticeDays;
  return {
    allowed,
    minNoticeDays,
    daysGiven,
    reason: allowed
      ? 'Notice period satisfied'
      : `Requires ${minNoticeDays} days notice; only ${daysGiven} given`,
  };
}
