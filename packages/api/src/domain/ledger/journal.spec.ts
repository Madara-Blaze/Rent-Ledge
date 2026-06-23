import { describe, expect, it } from 'vitest';
import { Money } from '../money/money';
import { AccountCode } from './accounts';
import {
  AccountRef,
  EmptyJournalEntryError,
  JournalCurrencyMismatchError,
  JournalEntryDraft,
  LedgerEntryType,
  NonPositivePostingError,
  UnbalancedJournalEntryError,
} from './journal';

const LANDLORD = 'll_1';
const TENANCY = 'tn_1';

const ref = (code: AccountCode): AccountRef => ({ code, landlordId: LANDLORD, tenancyId: TENANCY });
const inr = (minor: number) => Money.of(minor, 'INR');

const draft = () =>
  new JournalEntryDraft({
    entryType: LedgerEntryType.INVOICE,
    occurredAt: new Date('2026-06-01T00:00:00Z'),
    currency: 'INR',
    landlordId: LANDLORD,
    tenancyId: TENANCY,
  });

describe('JournalEntryDraft balancing', () => {
  it('builds a balanced rent invoice (receivable vs income)', () => {
    const entry = draft()
      .debit(ref(AccountCode.RENT_RECEIVABLE), inr(2_000_000))
      .credit(ref(AccountCode.RENT_INCOME), inr(2_000_000))
      .build();

    expect(entry.postings).toHaveLength(2);
    expect(entry.totalMinor).toBe(2_000_000n);
    expect(entry.entryType).toBe('INVOICE');
  });

  it('builds a balanced multi-line payment with TDS withholding', () => {
    // Tenant pays ₹49,000 cash + ₹1,000 TDS to settle ₹50,000 receivable.
    const entry = draft()
      .debit(ref(AccountCode.CASH), inr(4_900_000))
      .debit(ref(AccountCode.TDS_RECEIVABLE), inr(100_000))
      .credit(ref(AccountCode.RENT_RECEIVABLE), inr(5_000_000))
      .build();

    expect(entry.postings).toHaveLength(3);
    expect(entry.totalMinor).toBe(5_000_000n);
  });

  it('rejects an unbalanced entry', () => {
    expect(() =>
      draft()
        .debit(ref(AccountCode.CASH), inr(4_900_000))
        .credit(ref(AccountCode.RENT_RECEIVABLE), inr(5_000_000))
        .build(),
    ).toThrow(UnbalancedJournalEntryError);
  });

  it('rejects an entry with fewer than two postings', () => {
    expect(() => draft().debit(ref(AccountCode.CASH), inr(100)).build()).toThrow(EmptyJournalEntryError);
  });

  it('rejects non-positive posting amounts', () => {
    expect(() =>
      draft()
        .debit(ref(AccountCode.CASH), inr(0))
        .credit(ref(AccountCode.RENT_RECEIVABLE), inr(0))
        .build(),
    ).toThrow(NonPositivePostingError);
  });

  it('rejects a posting in a different currency', () => {
    expect(() =>
      draft()
        .debit(ref(AccountCode.CASH), Money.of(100, 'USD'))
        .credit(ref(AccountCode.RENT_RECEIVABLE), inr(100))
        .build(),
    ).toThrow(JournalCurrencyMismatchError);
  });

  it('produces an immutable entry', () => {
    const entry = draft()
      .debit(ref(AccountCode.RENT_RECEIVABLE), inr(100))
      .credit(ref(AccountCode.RENT_INCOME), inr(100))
      .build();
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.postings)).toBe(true);
  });
});
