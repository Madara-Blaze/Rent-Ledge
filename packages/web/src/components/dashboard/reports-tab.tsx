import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiDownload, apiFetch } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { Card, Empty, Stat } from './primitives';

interface IncomeStatement {
  period: string;
  totalIncomeMinor: string;
  lines: { label: string; amountMinor: string }[];
}
interface Pnl {
  totalIncomeMinor: string;
  totalExpenseMinor: string;
  netMinor: string;
  properties: { propertyName: string; incomeMinor: string; expenseMinor: string; netMinor: string }[];
}

export function ReportsTab({ landlordId }: { landlordId: string | null }) {
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async (lid: string) => {
    setIncome(await apiFetch<IncomeStatement>(`/workspaces/${lid}/reports/income-statement`).catch(() => null));
    setPnl(await apiFetch<Pnl>(`/workspaces/${lid}/reports/pnl`).catch(() => null));
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  if (!landlordId) return <Empty>This is a workspace (landlord) view.</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={`Income (${income?.period ?? 'FY'})`} value={formatINR(income?.totalIncomeMinor)} accent />
        <Stat label="Expenses" value={formatINR(pnl?.totalExpenseMinor)} />
        <Stat label="Net" value={formatINR(pnl?.netMinor)} />
      </div>

      <Card
        title="Year-end CA pack"
        action={
          <Button
            variant="primary"
            size="sm"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await apiDownload(`/workspaces/${landlordId}/reports/ca-pack.csv`, 'rentledger-ca-pack.csv');
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? 'Preparing…' : 'Download CSV'}
          </Button>
        }
      >
        <p className="text-sm text-white/50">Income, expenses, TDS and security deposits for the financial year, ready for your CA.</p>
      </Card>

      <Card title="Per-property P&L">
        {!pnl || pnl.properties.length === 0 ? (
          <Empty>No postings in this period yet.</Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Property</th>
                  <th className="px-4 py-2.5 text-right font-medium">Income</th>
                  <th className="px-4 py-2.5 text-right font-medium">Expense</th>
                  <th className="px-4 py-2.5 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {pnl.properties.map((p, i) => (
                  <tr key={i} className="border-t border-white/[0.06]">
                    <td className="px-4 py-2.5 text-white/80">{p.propertyName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{formatINR(p.incomeMinor)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{formatINR(p.expenseMinor)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white">{formatINR(p.netMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
