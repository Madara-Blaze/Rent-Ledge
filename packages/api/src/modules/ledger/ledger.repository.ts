import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { Pool } from 'pg';
import { AccountCode, accountTypeOf, signedBalanceMinor } from '../../domain/ledger/accounts';
import { AccountRef, JournalEntryDraftData } from '../../domain/ledger/journal';
import { daysBetween } from '../../domain/rules/dates';
import { DRIZZLE, PG_POOL, type Db } from '../../infra/db/db.module';
import { journalEntries, ledgerAccounts, ledgerPostings } from '../../infra/db/schema';

export interface AccountBalance {
  code: string;
  type: string;
  debitMinor: bigint;
  creditMinor: bigint;
  /** Signed by the account's normal side (positive = more of what it holds). */
  balanceMinor: bigint;
}

export interface ArrearsAgeing {
  bucket0to30: bigint;
  bucket31to60: bigint;
  bucket61to90: bigint;
  bucket90plus: bigint;
  totalOutstanding: bigint;
}

/**
 * The only writer to the ledger. Everything goes through postEntry, which inserts
 * one journal entry and its postings inside a transaction; the DB's deferred
 * balance trigger is the final guarantee that debits == credits.
 */
@Injectable()
export class LedgerRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  /** Run inside the given transaction, or start a new one. */
  async postEntry(draft: JournalEntryDraftData, existingTx?: Db): Promise<string> {
    if (existingTx) return this.insertEntry(existingTx, draft);
    return this.db.transaction((tx) => this.insertEntry(tx as unknown as Db, draft));
  }

  private async insertEntry(tx: Db, draft: JournalEntryDraftData): Promise<string> {
    if (draft.idempotencyKey) {
      const found = await tx
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, draft.idempotencyKey))
        .limit(1);
      if (found.length > 0) return found[0].id; // already posted — idempotent no-op
    }

    const [entry] = await tx
      .insert(journalEntries)
      .values({
        landlordId: draft.landlordId,
        tenancyId: draft.tenancyId ?? null,
        entryType: draft.entryType,
        occurredAt: draft.occurredAt,
        currency: draft.currency,
        description: draft.description ?? null,
        sourceType: draft.sourceType ?? null,
        sourceId: draft.sourceId ?? null,
        idempotencyKey: draft.idempotencyKey ?? null,
        reversalOf: draft.reversalOf ?? null,
        createdBy: draft.createdBy ?? null,
        totalMinor: draft.totalMinor,
      })
      .returning({ id: journalEntries.id });

    for (const p of draft.postings) {
      const accountId = await this.resolveAccountId(tx, p.account, draft.currency);
      await tx.insert(ledgerPostings).values({
        journalEntryId: entry.id,
        accountId,
        side: p.side,
        amountMinor: p.amount.amountMinor,
        currency: p.amount.currency,
        memo: p.memo ?? null,
      });
    }
    return entry.id;
  }

  /** Find (or lazily create) the concrete account for a scoped account reference. */
  private async resolveAccountId(tx: Db, ref: AccountRef, currency: string): Promise<string> {
    const where = and(
      eq(ledgerAccounts.landlordId, ref.landlordId),
      eq(ledgerAccounts.code, ref.code),
      ref.tenancyId ? eq(ledgerAccounts.tenancyId, ref.tenancyId) : isNull(ledgerAccounts.tenancyId),
      ref.propertyId
        ? eq(ledgerAccounts.propertyId, ref.propertyId)
        : isNull(ledgerAccounts.propertyId),
    );

    const existing = await tx.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(where).limit(1);
    if (existing.length > 0) return existing[0].id;

    const [created] = await tx
      .insert(ledgerAccounts)
      .values({
        landlordId: ref.landlordId,
        tenancyId: ref.tenancyId ?? null,
        propertyId: ref.propertyId ?? null,
        code: ref.code,
        type: accountTypeOf(ref.code),
        currency,
      })
      .returning({ id: ledgerAccounts.id });
    return created.id;
  }

  /** Per-account balances for a tenancy, computed from postings (never stored). */
  async getTenancyBalances(landlordId: string, tenancyId: string): Promise<AccountBalance[]> {
    const { rows } = await this.pool.query<{ code: string; type: string; debit: string; credit: string }>(
      `SELECT a.code, a.type,
              COALESCE(SUM(p.amount_minor) FILTER (WHERE p.side = 'DEBIT'), 0)::text  AS debit,
              COALESCE(SUM(p.amount_minor) FILTER (WHERE p.side = 'CREDIT'), 0)::text AS credit
         FROM ledger_accounts a
         LEFT JOIN ledger_postings p ON p.account_id = a.id
        WHERE a.landlord_id = $1 AND a.tenancy_id = $2
        GROUP BY a.code, a.type
        ORDER BY a.code`,
      [landlordId, tenancyId],
    );

    return rows.map((r) => {
      const debitMinor = BigInt(r.debit);
      const creditMinor = BigInt(r.credit);
      return {
        code: r.code,
        type: r.type,
        debitMinor,
        creditMinor,
        balanceMinor: signedBalanceMinor(r.code as AccountCode, debitMinor, creditMinor),
      };
    });
  }

  /** Arrears ageing built from outstanding invoice balances as-of a date. */
  async getArrearsAgeing(landlordId: string, tenancyId: string, asOf: Date): Promise<ArrearsAgeing> {
    const { rows } = await this.pool.query<{ due_date: string; outstanding: string }>(
      `SELECT i.due_date::text AS due_date,
              (i.amount_minor - COALESCE(SUM(a.amount_minor), 0))::text AS outstanding
         FROM invoices i
         LEFT JOIN payment_allocations a ON a.invoice_id = i.id
        WHERE i.landlord_id = $1 AND i.tenancy_id = $2
          AND i.status NOT IN ('VOID', 'WRITTEN_OFF')
        GROUP BY i.id
       HAVING (i.amount_minor - COALESCE(SUM(a.amount_minor), 0)) > 0`,
      [landlordId, tenancyId],
    );

    const ageing: ArrearsAgeing = {
      bucket0to30: 0n,
      bucket31to60: 0n,
      bucket61to90: 0n,
      bucket90plus: 0n,
      totalOutstanding: 0n,
    };

    for (const r of rows) {
      const outstanding = BigInt(r.outstanding);
      const age = daysBetween(new Date(`${r.due_date}T00:00:00Z`), asOf);
      ageing.totalOutstanding += outstanding;
      if (age <= 30) ageing.bucket0to30 += outstanding;
      else if (age <= 60) ageing.bucket31to60 += outstanding;
      else if (age <= 90) ageing.bucket61to90 += outstanding;
      else ageing.bucket90plus += outstanding;
    }
    return ageing;
  }
}
