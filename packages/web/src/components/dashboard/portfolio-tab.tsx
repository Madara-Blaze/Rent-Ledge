import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { Card, Empty, Stat } from './primitives';

interface Property {
  id: string;
  name: string;
}
interface Tenancy {
  id: string;
  propertyId: string;
  rentMinor: string;
  status: string;
}
interface Arrears {
  totalOutstanding: string;
}
interface IncomeStatement {
  period: string;
  totalIncomeMinor: string;
}

const ACTIVE = new Set(['ACTIVE', 'NOTICE_PERIOD']);

interface Row {
  propertyId: string;
  name: string;
  tenancies: number;
  active: number;
  rentRoll: bigint;
  outstanding: bigint;
}

export function PortfolioTab({ landlordId }: { landlordId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [totals, setTotals] = useState({ rentRoll: 0n, outstanding: 0n, active: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (lid: string) => {
    setLoading(true);
    try {
      const [properties, tenancies, inc] = await Promise.all([
        apiFetch<Property[]>(`/workspaces/${lid}/properties`).catch(() => []),
        apiFetch<Tenancy[]>(`/workspaces/${lid}/tenancies`).catch(() => []),
        apiFetch<IncomeStatement>(`/workspaces/${lid}/reports/income-statement`).catch(() => null),
      ]);
      setIncome(inc);

      // Pull outstanding per tenancy from the authoritative arrears endpoint.
      const arrears = await Promise.all(
        tenancies.map((t) =>
          apiFetch<Arrears>(`/tenancies/${t.id}/arrears`)
            .then((a) => BigInt(a.totalOutstanding || '0'))
            .catch(() => 0n),
        ),
      );

      const byProp = new Map<string, Row>();
      for (const p of properties) {
        byProp.set(p.id, { propertyId: p.id, name: p.name, tenancies: 0, active: 0, rentRoll: 0n, outstanding: 0n });
      }
      let rentRoll = 0n;
      let outstanding = 0n;
      let active = 0;
      tenancies.forEach((t, i) => {
        const row =
          byProp.get(t.propertyId) ??
          ({ propertyId: t.propertyId, name: 'Unknown property', tenancies: 0, active: 0, rentRoll: 0n, outstanding: 0n } as Row);
        if (!byProp.has(t.propertyId)) byProp.set(t.propertyId, row);
        row.tenancies += 1;
        row.outstanding += arrears[i];
        outstanding += arrears[i];
        if (ACTIVE.has(t.status)) {
          row.active += 1;
          row.rentRoll += BigInt(t.rentMinor || '0');
          rentRoll += BigInt(t.rentMinor || '0');
          active += 1;
        }
      });
      setRows([...byProp.values()]);
      setTotals({ rentRoll, outstanding, active });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  if (!landlordId) return <Empty>This is a workspace (landlord) view.</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly rent roll" value={formatINR(totals.rentRoll.toString())} sub="Active tenancies" accent />
        <Stat label="Total outstanding" value={formatINR(totals.outstanding.toString())} sub="Across all tenancies" />
        <Stat label={`Income (${income?.period ?? 'FY'})`} value={formatINR(income?.totalIncomeMinor)} sub="Collected" />
        <Stat label="Active tenancies" value={String(totals.active)} sub={`${rows.length} ${rows.length === 1 ? 'property' : 'properties'}`} />
      </div>

      <Card title="By property">
        {loading && rows.length === 0 ? (
          <Empty>Loading…</Empty>
        ) : rows.length === 0 ? (
          <Empty>No properties yet. Add one in the Properties tab.</Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Property</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tenancies</th>
                  <th className="px-4 py-2.5 text-right font-medium">Active</th>
                  <th className="px-4 py-2.5 text-right font-medium">Rent roll</th>
                  <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.propertyId} className="border-t border-white/[0.06]">
                    <td className="px-4 py-2.5 text-white/80">{r.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white/60">{r.tenancies}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white/60">{r.active}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white/80">{formatINR(r.rentRoll.toString())}</td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${r.outstanding > 0n ? 'text-[#FF6b6b]' : 'text-white/80'}`}
                    >
                      {formatINR(r.outstanding.toString())}
                    </td>
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
