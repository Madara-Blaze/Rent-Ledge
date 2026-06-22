import { describe, expect, it } from 'vitest';
import { INDIA_DEFAULT_POLICY } from '../policy/india-default.policy';
import { checkNoticePeriod, minNoticeDaysFor } from './notice-rules';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('notice period rules', () => {
  it('termination requires the policy notice window (30 days)', () => {
    expect(minNoticeDaysFor('TERMINATION', INDIA_DEFAULT_POLICY)).toBe(30);
  });

  it('blocks termination with too little notice', () => {
    const r = checkNoticePeriod('TERMINATION', INDIA_DEFAULT_POLICY, d('2026-06-01'), d('2026-06-20'));
    expect(r.allowed).toBe(false);
    expect(r.daysGiven).toBe(19);
  });

  it('allows termination with sufficient notice', () => {
    const r = checkNoticePeriod('TERMINATION', INDIA_DEFAULT_POLICY, d('2026-06-01'), d('2026-07-15'));
    expect(r.allowed).toBe(true);
  });

  it('rent reminders have no statutory window', () => {
    const r = checkNoticePeriod('RENT_REMINDER', INDIA_DEFAULT_POLICY, d('2026-06-01'));
    expect(r.allowed).toBe(true);
    expect(r.minNoticeDays).toBe(0);
  });
});
