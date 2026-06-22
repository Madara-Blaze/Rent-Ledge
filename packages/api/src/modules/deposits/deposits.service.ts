import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { AccountCode } from '../../domain/ledger/accounts';
import { JournalEntryDraft, LedgerEntryType } from '../../domain/ledger/journal';
import { Money } from '../../domain/money/money';
import { DRIZZLE, PG_POOL, type Db } from '../../infra/db/db.module';
import { depositAccounts, depositTransactions } from '../../infra/db/schema';
import { LedgerRepository } from '../ledger/ledger.repository';
import { TenancyRepository, TenancyRow } from '../tenancy/tenancy.repository';
import {
  CollectDepositDto,
  DeductDepositDto,
  DepositStatementDto,
  RefundDepositDto,
} from './deposits.dto';

interface Sums {
  collected: bigint;
  deducted: bigint;
  interest: bigint;
  refunded: bigint;
}

const rowsOf = <T>(res: unknown): T[] => (res as { rows: T[] }).rows;

function foldSums(rows: { type: string; total: string }[]): Sums {
  const s: Sums = { collected: 0n, deducted: 0n, interest: 0n, refunded: 0n };
  for (const r of rows) {
    const v = BigInt(r.total);
    if (r.type === 'COLLECTION') s.collected += v;
    else if (r.type === 'DEDUCTION') s.deducted += v;
    else if (r.type === 'INTEREST') s.interest += v;
    else if (r.type === 'REFUND') s.refunded += v;
  }
  return s;
}

function balanceHeldOf(s: Sums): bigint {
  return s.collected + s.interest - s.deducted - s.refunded;
}

function statusOf(s: Sums): string {
  const held = balanceHeldOf(s);
  if (s.refunded > 0n && held <= 0n) return 'REFUNDED';
  if (s.refunded > 0n) return 'PARTIALLY_REFUNDED';
  if (s.collected > 0n) return 'HELD';
  return 'PENDING';
}

@Injectable()
export class DepositsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly tenancyRepo: TenancyRepository,
    private readonly ledger: LedgerRepository,
  ) {}

  async collect(input: CollectDepositDto): Promise<DepositStatementDto> {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(input.tenancyId);
    const amount = Money.of(input.amountMinor, tenancy.currency);
    await this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const accountId = await this.ensureAccount(tx, tenancy);
      const draft = new JournalEntryDraft({
        entryType: LedgerEntryType.DEPOSIT_COLLECTION,
        occurredAt: new Date(),
        currency: tenancy.currency,
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        description: 'Security deposit collected',
        sourceType: 'deposit',
        sourceId: accountId,
        idempotencyKey: input.idempotencyKey,
      })
        .debit(this.acct(AccountCode.CASH, tenancy), amount)
        .credit(this.acct(AccountCode.SECURITY_DEPOSIT_LIABILITY, tenancy), amount)
        .build();
      const entryId = await this.ledger.postEntry(draft, tx);
      await this.recordTxn(tx, accountId, entryId, 'COLLECTION', amount, undefined, undefined);
      await this.applyStatus(tx, accountId);
    });
    return this.getStatement(input.tenancyId);
  }

  async deduct(input: DeductDepositDto): Promise<DepositStatementDto> {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(input.tenancyId);
    const amount = Money.of(input.amountMinor, tenancy.currency);
    await this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const accountId = await this.ensureAccount(tx, tenancy);
      await this.assertWithinBalance(tx, accountId, amount);
      const draft = new JournalEntryDraft({
        entryType: LedgerEntryType.DEPOSIT_DEDUCTION,
        occurredAt: new Date(),
        currency: tenancy.currency,
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        description: `Deposit deduction: ${input.reason}`,
        sourceType: 'deposit',
        sourceId: accountId,
        idempotencyKey: input.idempotencyKey,
      })
        .debit(this.acct(AccountCode.SECURITY_DEPOSIT_LIABILITY, tenancy), amount)
        .credit(this.acct(AccountCode.DAMAGE_RECOVERY_INCOME, tenancy), amount)
        .build();
      const entryId = await this.ledger.postEntry(draft, tx);
      await this.recordTxn(tx, accountId, entryId, 'DEDUCTION', amount, input.reason, input.evidenceRef);
      await this.applyStatus(tx, accountId);
    });
    return this.getStatement(input.tenancyId);
  }

  async refund(input: RefundDepositDto): Promise<DepositStatementDto> {
    const tenancy = await this.tenancyRepo.findByIdOrThrow(input.tenancyId);
    const amount = Money.of(input.amountMinor, tenancy.currency);
    await this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const accountId = await this.ensureAccount(tx, tenancy);
      await this.assertWithinBalance(tx, accountId, amount);
      const draft = new JournalEntryDraft({
        entryType: LedgerEntryType.DEPOSIT_REFUND,
        occurredAt: new Date(),
        currency: tenancy.currency,
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        description: 'Security deposit refunded',
        sourceType: 'deposit',
        sourceId: accountId,
        idempotencyKey: input.idempotencyKey,
      })
        .debit(this.acct(AccountCode.SECURITY_DEPOSIT_LIABILITY, tenancy), amount)
        .credit(this.acct(AccountCode.CASH, tenancy), amount)
        .build();
      const entryId = await this.ledger.postEntry(draft, tx);
      await this.recordTxn(tx, accountId, entryId, 'REFUND', amount, undefined, undefined);
      await this.applyStatus(tx, accountId);
    });
    return this.getStatement(input.tenancyId);
  }

  /** Read-only settlement statement for the deposit subledger. */
  async getStatement(tenancyId: string): Promise<DepositStatementDto> {
    const { rows } = await this.pool.query<{
      id: string;
      currency: string;
      status: string;
      target_minor: string;
    }>(
      `SELECT id, currency, status, target_minor::text FROM deposit_accounts WHERE tenancy_id = $1`,
      [tenancyId],
    );
    const acc = rows[0];
    if (!acc) throw new NotFoundException(`No deposit account for tenancy ${tenancyId}`);

    const sumRows = await this.pool.query<{ type: string; total: string }>(
      `SELECT type, COALESCE(SUM(amount_minor), 0)::text AS total
         FROM deposit_transactions WHERE deposit_account_id = $1 GROUP BY type`,
      [acc.id],
    );
    const sums = foldSums(sumRows.rows);
    const m = (v: bigint) => ({ amountMinor: v.toString(), currency: acc.currency });

    return {
      tenancyId,
      currency: acc.currency,
      status: acc.status,
      target: m(BigInt(acc.target_minor)),
      collected: m(sums.collected),
      deducted: m(sums.deducted),
      interest: m(sums.interest),
      refunded: m(sums.refunded),
      balanceHeld: m(balanceHeldOf(sums)),
    };
  }

  // --- internals -----------------------------------------------------------

  private async ensureAccount(tx: Db, tenancy: TenancyRow): Promise<string> {
    const existing = await tx
      .select({ id: depositAccounts.id })
      .from(depositAccounts)
      .where(eq(depositAccounts.tenancyId, tenancy.id))
      .limit(1);
    if (existing.length > 0) return existing[0].id;
    const [created] = await tx
      .insert(depositAccounts)
      .values({
        landlordId: tenancy.landlordId,
        tenancyId: tenancy.id,
        currency: tenancy.currency,
        targetMinor: tenancy.depositMinor,
        status: 'PENDING',
      })
      .returning({ id: depositAccounts.id });
    return created.id;
  }

  private async readSums(tx: Db, accountId: string): Promise<Sums> {
    const res = await tx.execute(sql`
      SELECT type, COALESCE(SUM(amount_minor), 0)::text AS total
        FROM deposit_transactions WHERE deposit_account_id = ${accountId} GROUP BY type`);
    return foldSums(rowsOf<{ type: string; total: string }>(res));
  }

  private async assertWithinBalance(tx: Db, accountId: string, amount: Money): Promise<void> {
    const held = balanceHeldOf(await this.readSums(tx, accountId));
    if (amount.amountMinor > held) {
      throw new BadRequestException(
        `Amount exceeds deposit balance held (${held.toString()} minor units)`,
      );
    }
  }

  private async recordTxn(
    tx: Db,
    accountId: string,
    entryId: string,
    type: 'COLLECTION' | 'DEDUCTION' | 'REFUND' | 'INTEREST',
    amount: Money,
    reason: string | undefined,
    evidenceRef: string | undefined,
  ): Promise<void> {
    // Idempotent: if this ledger entry already produced a deposit txn, skip.
    const dup = await tx
      .select({ id: depositTransactions.id })
      .from(depositTransactions)
      .where(eq(depositTransactions.journalEntryId, entryId))
      .limit(1);
    if (dup.length > 0) return;
    await tx.insert(depositTransactions).values({
      depositAccountId: accountId,
      type,
      amountMinor: amount.amountMinor,
      reason: reason ?? null,
      evidenceRef: evidenceRef ?? null,
      journalEntryId: entryId,
    });
  }

  private async applyStatus(tx: Db, accountId: string): Promise<void> {
    const sums = await this.readSums(tx, accountId);
    await tx
      .update(depositAccounts)
      .set({ status: statusOf(sums), updatedAt: new Date() })
      .where(eq(depositAccounts.id, accountId));
  }

  private acct(code: AccountCode, tenancy: TenancyRow) {
    return { code, landlordId: tenancy.landlordId, tenancyId: tenancy.id, propertyId: tenancy.propertyId };
  }
}
