import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { csvSections, toCsv } from '../../domain/reports/csv';
import { indianFinancialYear } from '../../domain/reports/fiscal-year';
import { PG_POOL } from '../../infra/db/db.module';

export interface PeriodParams {
  from?: string;
  to?: string;
  propertyId?: string;
  tenancyId?: string;
}

interface AggRow {
  code: string;
  type: string;
  propertyId: string | null;
  tenancyId: string | null;
  signed: bigint;
}

const LABELS: Record<string, string> = {
  RENT_INCOME: 'Rent income',
  LATE_FEE_INCOME: 'Late fee income',
  DAMAGE_RECOVERY_INCOME: 'Damage recovery income',
  MAINTENANCE_RECOVERY_INCOME: 'Maintenance recovery income',
  DEPOSIT_INTEREST_EXPENSE: 'Deposit interest',
  MAINTENANCE_EXPENSE: 'Maintenance expense',
  WRITE_OFF_EXPENSE: 'Write-offs',
};

/** Signed balance for a period figure: assets/expenses are debit-normal. */
function signedByType(type: string, debit: bigint, credit: bigint): bigint {
  return type === 'ASSET' || type === 'EXPENSE' ? debit - credit : credit - debit;
}

@Injectable()
export class ReportsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ---- income / expense / P&L ----

  async incomeStatement(landlordId: string, params: PeriodParams) {
    const period = this.resolvePeriod(params);
    const rows = await this.aggregate(landlordId, period.from, period.to, params);
    const byCode = this.sumByCode(rows, 'INCOME');
    const lines = [...byCode].map(([code, amt]) => ({ code, label: LABELS[code] ?? code, amountMinor: amt.toString() }));
    const total = [...byCode.values()].reduce((a, b) => a + b, 0n);
    return { period: period.label, from: period.from, to: period.to, lines, totalIncomeMinor: total.toString() };
  }

  async expenseReport(landlordId: string, params: PeriodParams) {
    const period = this.resolvePeriod(params);
    const rows = await this.aggregate(landlordId, period.from, period.to, params);
    const byCode = this.sumByCode(rows, 'EXPENSE');
    const lines = [...byCode].map(([code, amt]) => ({ code, label: LABELS[code] ?? code, amountMinor: amt.toString() }));
    const total = [...byCode.values()].reduce((a, b) => a + b, 0n);
    return { period: period.label, from: period.from, to: period.to, lines, totalExpenseMinor: total.toString() };
  }

  async profitAndLoss(landlordId: string, params: PeriodParams) {
    const period = this.resolvePeriod(params);
    const rows = await this.aggregate(landlordId, period.from, period.to, params);
    const byProperty = new Map<string | null, { income: bigint; expense: bigint }>();
    for (const r of rows) {
      if (r.type !== 'INCOME' && r.type !== 'EXPENSE') continue;
      const cur = byProperty.get(r.propertyId) ?? { income: 0n, expense: 0n };
      if (r.type === 'INCOME') cur.income += r.signed;
      else cur.expense += r.signed;
      byProperty.set(r.propertyId, cur);
    }
    const names = await this.propertyNames(landlordId);
    const properties = [...byProperty].map(([pid, v]) => ({
      propertyId: pid,
      propertyName: pid ? names.get(pid) ?? '' : 'Unassigned',
      incomeMinor: v.income.toString(),
      expenseMinor: v.expense.toString(),
      netMinor: (v.income - v.expense).toString(),
    }));
    const totalIncome = [...byProperty.values()].reduce((a, b) => a + b.income, 0n);
    const totalExpense = [...byProperty.values()].reduce((a, b) => a + b.expense, 0n);
    return {
      period: period.label,
      properties,
      totalIncomeMinor: totalIncome.toString(),
      totalExpenseMinor: totalExpense.toString(),
      netMinor: (totalIncome - totalExpense).toString(),
    };
  }

  // ---- TDS / deposits ----

  async tdsSummary(landlordId: string, params: PeriodParams) {
    const period = this.resolvePeriod(params);
    const rows = await this.aggregate(landlordId, period.from, period.to, params);
    const byTenancy = new Map<string | null, bigint>();
    let total = 0n;
    for (const r of rows) {
      if (r.code !== 'TDS_RECEIVABLE') continue;
      byTenancy.set(r.tenancyId, (byTenancy.get(r.tenancyId) ?? 0n) + r.signed);
      total += r.signed;
    }
    return {
      period: period.label,
      totalTdsMinor: total.toString(),
      byTenancy: [...byTenancy].map(([tenancyId, amt]) => ({ tenancyId, amountMinor: amt.toString() })),
    };
  }

  async depositsSummary(landlordId: string) {
    const { rows } = await this.pool.query<{ tenancy_id: string | null; debit: string; credit: string }>(
      `SELECT a.tenancy_id,
              COALESCE(SUM(p.amount_minor) FILTER (WHERE p.side = 'DEBIT'), 0)::text  AS debit,
              COALESCE(SUM(p.amount_minor) FILTER (WHERE p.side = 'CREDIT'), 0)::text AS credit
         FROM ledger_postings p
         JOIN ledger_accounts a ON a.id = p.account_id
        WHERE a.landlord_id = $1 AND a.code = 'SECURITY_DEPOSIT_LIABILITY'
        GROUP BY a.tenancy_id`,
      [landlordId],
    );
    const byTenancy = rows.map((r) => ({ tenancyId: r.tenancy_id, heldMinor: (BigInt(r.credit) - BigInt(r.debit)).toString() }));
    const total = byTenancy.reduce((a, b) => a + BigInt(b.heldMinor), 0n);
    return { totalHeldMinor: total.toString(), byTenancy };
  }

  // ---- CA year-end pack ----

  async caPack(landlordId: string, fyInput?: string) {
    const fy = indianFinancialYear(fyInput ?? new Date());
    const params: PeriodParams = { from: fy.from, to: fy.toExclusive };
    const [income, expenses, tds, deposits] = await Promise.all([
      this.incomeStatement(landlordId, params),
      this.expenseReport(landlordId, params),
      this.tdsSummary(landlordId, params),
      this.depositsSummary(landlordId),
    ]);
    return {
      financialYear: fy.label,
      period: { from: fy.from, to: fy.toExclusive },
      income,
      expenses,
      tds,
      deposits,
      generatedAt: new Date().toISOString(),
    };
  }

  async caPackCsv(landlordId: string, fyInput?: string): Promise<string> {
    const pack = await this.caPack(landlordId, fyInput);
    return csvSections([
      {
        title: `Rental income (FY ${pack.financialYear})`,
        csv: toCsv(['Account', 'Amount (paise)'], [...pack.income.lines.map((l) => [l.label, l.amountMinor]), ['TOTAL', pack.income.totalIncomeMinor]]),
      },
      {
        title: 'Expenses',
        csv: toCsv(['Account', 'Amount (paise)'], [...pack.expenses.lines.map((l) => [l.label, l.amountMinor]), ['TOTAL', pack.expenses.totalExpenseMinor]]),
      },
      {
        title: 'TDS',
        csv: toCsv(['Tenancy', 'TDS (paise)'], [...pack.tds.byTenancy.map((t) => [t.tenancyId, t.amountMinor]), ['TOTAL', pack.tds.totalTdsMinor]]),
      },
      {
        title: 'Security deposits held',
        csv: toCsv(['Tenancy', 'Held (paise)'], [...pack.deposits.byTenancy.map((d) => [d.tenancyId, d.heldMinor]), ['TOTAL', pack.deposits.totalHeldMinor]]),
      },
    ]);
  }

  // ---- internals ----

  private resolvePeriod(p: PeriodParams): { from: string; to: string; label: string } {
    if (p.from && p.to) return { from: p.from, to: p.to, label: `${p.from}..${p.to}` };
    const fy = indianFinancialYear(p.from ?? new Date());
    return { from: fy.from, to: fy.toExclusive, label: `FY ${fy.label}` };
  }

  private async aggregate(landlordId: string, from: string, to: string, p: PeriodParams): Promise<AggRow[]> {
    const params: unknown[] = [landlordId, from, to];
    let sql = `SELECT a.code, a.type, a.property_id, a.tenancy_id,
        COALESCE(SUM(pp.amount_minor) FILTER (WHERE pp.side = 'DEBIT'), 0)::text  AS debit,
        COALESCE(SUM(pp.amount_minor) FILTER (WHERE pp.side = 'CREDIT'), 0)::text AS credit
      FROM ledger_postings pp
      JOIN ledger_accounts a ON a.id = pp.account_id
      JOIN journal_entries j ON j.id = pp.journal_entry_id
      WHERE a.landlord_id = $1 AND j.occurred_at >= $2 AND j.occurred_at < $3`;
    if (p.propertyId) {
      params.push(p.propertyId);
      sql += ` AND a.property_id = $${params.length}`;
    }
    if (p.tenancyId) {
      params.push(p.tenancyId);
      sql += ` AND a.tenancy_id = $${params.length}`;
    }
    sql += ` GROUP BY a.code, a.type, a.property_id, a.tenancy_id`;

    const { rows } = await this.pool.query<{
      code: string;
      type: string;
      property_id: string | null;
      tenancy_id: string | null;
      debit: string;
      credit: string;
    }>(sql, params);

    return rows.map((r) => ({
      code: r.code,
      type: r.type,
      propertyId: r.property_id,
      tenancyId: r.tenancy_id,
      signed: signedByType(r.type, BigInt(r.debit), BigInt(r.credit)),
    }));
  }

  private sumByCode(rows: AggRow[], type: string): Map<string, bigint> {
    const byCode = new Map<string, bigint>();
    for (const r of rows) {
      if (r.type !== type) continue;
      byCode.set(r.code, (byCode.get(r.code) ?? 0n) + r.signed);
    }
    return byCode;
  }

  private async propertyNames(landlordId: string): Promise<Map<string, string>> {
    const { rows } = await this.pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM properties WHERE landlord_id = $1`,
      [landlordId],
    );
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
