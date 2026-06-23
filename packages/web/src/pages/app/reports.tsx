import { Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Banner,
  Card,
  DataTable,
  Field,
  PageHeader,
  Select,
  Stat,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiDownload, apiFetch, downloadJson } from '@/lib/api';
import { formatINR, shortId } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface Line {
  code: string;
  label: string;
  amountMinor: string;
}
interface IncomeStatement {
  period: string;
  lines: Line[];
  totalIncomeMinor: string;
}
interface ExpenseReport {
  period: string;
  lines: Line[];
  totalExpenseMinor: string;
}
interface Pnl {
  period: string;
  properties: { propertyId: string | null; propertyName: string; incomeMinor: string; expenseMinor: string; netMinor: string }[];
  totalIncomeMinor: string;
  totalExpenseMinor: string;
  netMinor: string;
}
interface TdsSummary {
  totalTdsMinor: string;
  byTenancy: { tenancyId: string | null; amountMinor: string }[];
}
interface DepositsSummary {
  totalHeldMinor: string;
  byTenancy: { tenancyId: string | null; heldMinor: string }[];
}

export function ReportsPage() {
  const { landlordId, properties, tenancies } = useWorkspace();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [fy, setFy] = useState('');
  const [downloading, setDownloading] = useState<'csv' | 'json' | null>(null);

  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [expense, setExpense] = useState<ExpenseReport | null>(null);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [tds, setTds] = useState<TdsSummary | null>(null);
  const [deposits, setDeposits] = useState<DepositsSummary | null>(null);

  const tenancyLabel = (id: string | null) => {
    if (!id) return 'Unassigned';
    const t = tenancies.find((x) => x.id === id);
    return t ? t.propertyName : shortId(id);
  };

  const load = useCallback(async () => {
    if (!landlordId) return;
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    if (propertyId) qs.set('propertyId', propertyId);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const base = `/workspaces/${landlordId}/reports`;
    setIncome(await apiFetch<IncomeStatement>(`${base}/income-statement${q}`).catch(() => null));
    setExpense(await apiFetch<ExpenseReport>(`${base}/expense-report${q}`).catch(() => null));
    setPnl(await apiFetch<Pnl>(`${base}/pnl${q}`).catch(() => null));
    setTds(await apiFetch<TdsSummary>(`${base}/tds-summary${q}`).catch(() => null));
    setDeposits(await apiFetch<DepositsSummary>(`${base}/deposits-summary`).catch(() => null));
  }, [landlordId, from, to, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Reports" />
        <Banner tone="blue">Reports are available to landlord-workspace owners, managers and accountants.</Banner>
      </div>
    );
  }

  async function caPackCsv() {
    setDownloading('csv');
    try {
      await apiDownload(`/workspaces/${landlordId}/reports/ca-pack.csv${fy ? `?fy=${fy}` : ''}`, 'rentledger-ca-pack.csv');
    } finally {
      setDownloading(null);
    }
  }
  async function caPackJson() {
    setDownloading('json');
    try {
      await downloadJson(`/workspaces/${landlordId}/reports/ca-pack${fy ? `?fy=${fy}` : ''}`, 'rentledger-ca-pack.json');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Income, expenses, P&L, TDS and deposits — parameterised by period and property." />

      <Card title="Filters" className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="From" type="date" value={from} onChange={setFrom} hint="Defaults to current FY" />
          <Field label="To" type="date" value={to} onChange={setTo} />
          <Select
            label="Property"
            value={propertyId}
            onChange={setPropertyId}
            options={[{ value: '', label: 'All properties' }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <div className="flex items-end">
            <Button variant="outline" size="sm" className="w-full" onClick={() => void load()}>
              Apply
            </Button>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={`Income (${income?.period ?? 'FY'})`} value={formatINR(income?.totalIncomeMinor)} accent />
        <Stat label="Expenses" value={formatINR(pnl?.totalExpenseMinor ?? expense?.totalExpenseMinor)} />
        <Stat label="Net" value={formatINR(pnl?.netMinor)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Rental-income statement">
          <DataTable
            columns={[
              { header: 'Account', render: (l: Line) => l.label },
              { header: 'Amount', align: 'right', render: (l: Line) => formatINR(l.amountMinor) },
            ]}
            rows={income?.lines ?? []}
            keyOf={(l) => l.code}
            empty="No income in this period."
          />
        </Card>
        <Card title="Expense report">
          <DataTable
            columns={[
              { header: 'Account', render: (l: Line) => l.label },
              { header: 'Amount', align: 'right', render: (l: Line) => formatINR(l.amountMinor) },
            ]}
            rows={expense?.lines ?? []}
            keyOf={(l) => l.code}
            empty="No expenses in this period."
          />
        </Card>
      </div>

      <Card title="Per-property P&L" className="mt-6">
        <DataTable
          columns={[
            { header: 'Property', render: (p) => p.propertyName },
            { header: 'Income', align: 'right', render: (p) => formatINR(p.incomeMinor) },
            { header: 'Expense', align: 'right', render: (p) => formatINR(p.expenseMinor) },
            { header: 'Net', align: 'right', render: (p) => <span className="text-white">{formatINR(p.netMinor)}</span> },
          ]}
          rows={pnl?.properties ?? []}
          keyOf={(p, i) => p.propertyId ?? `row-${i}`}
          empty="No postings in this period."
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="TDS summary" action={<span className="text-sm text-white/60">{formatINR(tds?.totalTdsMinor)}</span>}>
          <DataTable
            columns={[
              { header: 'Tenancy', render: (t) => tenancyLabel(t.tenancyId) },
              { header: 'TDS', align: 'right', render: (t) => formatINR(t.amountMinor) },
            ]}
            rows={tds?.byTenancy ?? []}
            keyOf={(t, i) => t.tenancyId ?? `row-${i}`}
            empty="No TDS recorded."
          />
        </Card>
        <Card title="Security deposits held" action={<span className="text-sm text-white/60">{formatINR(deposits?.totalHeldMinor)}</span>}>
          <DataTable
            columns={[
              { header: 'Tenancy', render: (d) => tenancyLabel(d.tenancyId) },
              { header: 'Held', align: 'right', render: (d) => formatINR(d.heldMinor) },
            ]}
            rows={deposits?.byTenancy ?? []}
            keyOf={(d, i) => d.tenancyId ?? `row-${i}`}
            empty="No deposits held."
          />
        </Card>
      </div>

      <Card
        title="Year-end CA pack"
        className="mt-6"
        description="Income, expenses, TDS and deposits for the financial year, ready for your CA."
        action={
          <div className="flex items-end gap-2">
            <div className="w-28">
              <Field label="FY" value={fy} onChange={setFy} placeholder="2025-26" />
            </div>
            <Button variant="outline" size="sm" disabled={downloading !== null} onClick={() => void caPackJson()}>
              <Download className="size-4" /> {downloading === 'json' ? '…' : 'JSON'}
            </Button>
            <Button variant="primary" size="sm" disabled={downloading !== null} onClick={() => void caPackCsv()}>
              <Download className="size-4" /> {downloading === 'csv' ? '…' : 'CSV'}
            </Button>
          </div>
        }
      >
        <Banner tone="amber">Figures are computed from the ledger and policy data — not tax advice. Have your CA review before filing.</Banner>
      </Card>
    </div>
  );
}
