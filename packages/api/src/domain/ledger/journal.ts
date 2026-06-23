/**
 * Journal entries: the only way money enters the ledger.
 *
 * Every financial event (invoice, payment, late fee, deposit move, TDS, refund,
 * adjustment, reversal) becomes ONE journal entry with two or more postings that
 * sum to zero (Σdebits == Σcredits). The persistence layer stores entries and
 * postings append-only; corrections are made by posting a REVERSAL, never by
 * editing or deleting. This module is the pure, framework-free invariant guard.
 */

import { Money } from '../money/money';
import { AccountCode } from './accounts';

export type PostingSide = 'DEBIT' | 'CREDIT';

/** The business reason for an entry. Drives reporting and reconciliation. */
export const LedgerEntryType = {
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  LATE_FEE: 'LATE_FEE',
  DEPOSIT_COLLECTION: 'DEPOSIT_COLLECTION',
  DEPOSIT_DEDUCTION: 'DEPOSIT_DEDUCTION',
  DEPOSIT_REFUND: 'DEPOSIT_REFUND',
  DEPOSIT_INTEREST: 'DEPOSIT_INTEREST',
  TDS_DEDUCTION: 'TDS_DEDUCTION',
  ADVANCE_APPLICATION: 'ADVANCE_APPLICATION',
  WRITE_OFF: 'WRITE_OFF',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

/**
 * A reference to a ledger account, scoped for strict per-landlord isolation.
 * The repository resolves (or lazily creates) the concrete account row from
 * this tuple — domain code never deals in database ids.
 */
export interface AccountRef {
  code: AccountCode;
  landlordId: string;
  tenancyId?: string | null;
  propertyId?: string | null;
}

export interface DraftPosting {
  account: AccountRef;
  side: PostingSide;
  amount: Money;
  memo?: string;
}

export interface JournalEntryMeta {
  entryType: LedgerEntryType;
  /** Business/effective date of the event (not the system write time). */
  occurredAt: Date;
  currency: string;
  landlordId: string;
  tenancyId?: string | null;
  description?: string;
  /** Polymorphic link to the originating record (invoice/payment/etc.). */
  sourceType?: string;
  sourceId?: string;
  /** Dedup key so retried/duplicated webhooks post at most once. */
  idempotencyKey?: string;
  /** When this entry reverses another, its id. */
  reversalOf?: string;
  createdBy?: string;
}

export interface JournalEntryDraftData extends JournalEntryMeta {
  postings: ReadonlyArray<DraftPosting>;
  totalMinor: bigint;
}

export class EmptyJournalEntryError extends Error {
  constructor() {
    super('A journal entry needs at least two postings');
    this.name = 'EmptyJournalEntryError';
  }
}

export class NonPositivePostingError extends Error {
  constructor(code: AccountCode) {
    super(`Posting to ${code} must be a positive amount`);
    this.name = 'NonPositivePostingError';
  }
}

export class JournalCurrencyMismatchError extends Error {
  constructor(expected: string, got: string) {
    super(`Posting currency ${got} does not match entry currency ${expected}`);
    this.name = 'JournalCurrencyMismatchError';
  }
}

export class UnbalancedJournalEntryError extends Error {
  constructor(debitMinor: bigint, creditMinor: bigint) {
    super(`Journal entry is unbalanced: debits=${debitMinor} credits=${creditMinor}`);
    this.name = 'UnbalancedJournalEntryError';
  }
}

/**
 * Fluent builder that enforces the double-entry invariant at build() time.
 *
 *   new JournalEntryDraft({ entryType: 'INVOICE', ... })
 *     .debit(rentReceivable, amount)
 *     .credit(rentIncome, amount)
 *     .build();
 */
export class JournalEntryDraft {
  private readonly postings: DraftPosting[] = [];

  constructor(private readonly meta: JournalEntryMeta) {}

  debit(account: AccountRef, amount: Money, memo?: string): this {
    this.postings.push({ account, side: 'DEBIT', amount, memo });
    return this;
  }

  credit(account: AccountRef, amount: Money, memo?: string): this {
    this.postings.push({ account, side: 'CREDIT', amount, memo });
    return this;
  }

  /** Validate the invariants and return an immutable, ready-to-persist entry. */
  build(): JournalEntryDraftData {
    if (this.postings.length < 2) throw new EmptyJournalEntryError();

    let debitMinor = 0n;
    let creditMinor = 0n;
    for (const p of this.postings) {
      if (p.amount.currency !== this.meta.currency) {
        throw new JournalCurrencyMismatchError(this.meta.currency, p.amount.currency);
      }
      if (!p.amount.isPositive()) {
        throw new NonPositivePostingError(p.account.code);
      }
      if (p.side === 'DEBIT') debitMinor += p.amount.amountMinor;
      else creditMinor += p.amount.amountMinor;
    }

    if (debitMinor !== creditMinor) {
      throw new UnbalancedJournalEntryError(debitMinor, creditMinor);
    }

    return Object.freeze({
      ...this.meta,
      postings: Object.freeze([...this.postings]),
      totalMinor: debitMinor,
    });
  }
}
