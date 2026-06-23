/**
 * Chart of accounts for the rental domain.
 *
 * The ledger is classic double-entry. Each account has a *type* that determines
 * its "normal" side: ASSET/EXPENSE balances grow on the DEBIT side, while
 * LIABILITY/INCOME/EQUITY balances grow on the CREDIT side. A balance is always
 * computed from postings (sum of debits − sum of credits, then signed by the
 * account's normal side) — it is never stored as a mutable field.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';

export type NormalSide = 'DEBIT' | 'CREDIT';

export const NORMAL_SIDE: Record<AccountType, NormalSide> = {
  ASSET: 'DEBIT',
  EXPENSE: 'DEBIT',
  LIABILITY: 'CREDIT',
  INCOME: 'CREDIT',
  EQUITY: 'CREDIT',
};

/**
 * Account codes used by the financial-core flows. Each concrete ledger_account
 * row is one of these codes scoped to a landlord and (usually) a tenancy.
 */
export enum AccountCode {
  /** Cash/bank/gateway clearing — money actually received. */
  CASH = 'CASH',
  /** Rent billed to the tenant but not yet paid. */
  RENT_RECEIVABLE = 'RENT_RECEIVABLE',
  /** Rent recognised as earned income. */
  RENT_INCOME = 'RENT_INCOME',
  /** Late fees billed but unpaid. */
  LATE_FEE_RECEIVABLE = 'LATE_FEE_RECEIVABLE',
  /** Late fees recognised as income. */
  LATE_FEE_INCOME = 'LATE_FEE_INCOME',
  /** Unallocated tenant money (advances / credit carried forward). */
  TENANT_ADVANCE = 'TENANT_ADVANCE',
  /** Security deposit held — a liability we owe back to the tenant. */
  SECURITY_DEPOSIT_LIABILITY = 'SECURITY_DEPOSIT_LIABILITY',
  /** Interest accrued on the deposit where a jurisdiction mandates it. */
  DEPOSIT_INTEREST_EXPENSE = 'DEPOSIT_INTEREST_EXPENSE',
  /** Tax deducted at source by the tenant — claimable by the landlord. */
  TDS_RECEIVABLE = 'TDS_RECEIVABLE',
  /** Move-out deductions for damage/cleaning recognised as income. */
  DAMAGE_RECOVERY_INCOME = 'DAMAGE_RECOVERY_INCOME',
  /** Maintenance cost recovered from the tenant (chargeback). */
  MAINTENANCE_RECOVERY_INCOME = 'MAINTENANCE_RECOVERY_INCOME',
  /** Maintenance cost borne by the landlord. */
  MAINTENANCE_EXPENSE = 'MAINTENANCE_EXPENSE',
  /** Uncollectable balances written off. */
  WRITE_OFF_EXPENSE = 'WRITE_OFF_EXPENSE',
}

export const ACCOUNT_TYPE: Record<AccountCode, AccountType> = {
  [AccountCode.CASH]: 'ASSET',
  [AccountCode.RENT_RECEIVABLE]: 'ASSET',
  [AccountCode.RENT_INCOME]: 'INCOME',
  [AccountCode.LATE_FEE_RECEIVABLE]: 'ASSET',
  [AccountCode.LATE_FEE_INCOME]: 'INCOME',
  [AccountCode.TENANT_ADVANCE]: 'LIABILITY',
  [AccountCode.SECURITY_DEPOSIT_LIABILITY]: 'LIABILITY',
  [AccountCode.DEPOSIT_INTEREST_EXPENSE]: 'EXPENSE',
  [AccountCode.TDS_RECEIVABLE]: 'ASSET',
  [AccountCode.DAMAGE_RECOVERY_INCOME]: 'INCOME',
  [AccountCode.MAINTENANCE_RECOVERY_INCOME]: 'INCOME',
  [AccountCode.MAINTENANCE_EXPENSE]: 'EXPENSE',
  [AccountCode.WRITE_OFF_EXPENSE]: 'EXPENSE',
};

export function accountTypeOf(code: AccountCode): AccountType {
  return ACCOUNT_TYPE[code];
}

export function normalSideOf(code: AccountCode): NormalSide {
  return NORMAL_SIDE[ACCOUNT_TYPE[code]];
}

/**
 * Given the raw debit/credit totals on an account, return the balance signed by
 * the account's normal side. A positive number always means "more of what this
 * account normally holds" (e.g. a positive RENT_RECEIVABLE = rent still owed).
 */
export function signedBalanceMinor(code: AccountCode, debitMinor: bigint, creditMinor: bigint): bigint {
  return normalSideOf(code) === 'DEBIT' ? debitMinor - creditMinor : creditMinor - debitMinor;
}
