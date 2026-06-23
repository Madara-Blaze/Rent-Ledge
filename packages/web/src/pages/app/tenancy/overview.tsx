import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TenancyGate } from '@/components/app/tenancy-gate';
import { Card, DataTable, PageHeader, Stat } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatINR, titleCase } from '@/lib/format';

interface Balance {
  code: string;
  type: string;
  balanceMinor: string;
}
interface Arrears {
  bucket0to30: string;
  bucket31to60: string;
  bucket61to90: string;
  bucket90plus: string;
  totalOutstanding: string;
}
interface DepositStatement {
  status: string;
  balanceHeld: { amountMinor: string };
}
interface TdsPreview {
  applicable: boolean;
  section?: string;
  amount?: { amountMinor: string };
}

export function TenancyOverviewPage() {
  return (
    <div>
      <PageHeader title="Tenancy overview" description="Live finances for the selected tenancy, computed from the ledger." />
      <TenancyGate>{({ tenancyId }) => <OverviewBody tenancyId={tenancyId} />}</TenancyGate>
    </div>
  );
}

function OverviewBody({ tenancyId }: { tenancyId: string }) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [arrears, setArrears] = useState<Arrears | null>(null);
  const [deposit, setDeposit] = useState<DepositStatement | null>(null);
  const [tds, setTds] = useState<TdsPreview | null>(null);

  const load = useCallback(async (id: string) => {
    const [b, a] = await Promise.all([
      apiFetch<Balance[]>(`/tenancies/${id}/ledger`).catch(() => []),
      apiFetch<Arrears>(`/tenancies/${id}/arrears`).catch(() => null),
    ]);
    setBalances(b);
    setArrears(a);
    setDeposit(await apiFetch<DepositStatement>(`/deposits/${id}/statement`).catch(() => null));
    setTds(await apiFetch<TdsPreview>(`/tax/tds/preview?tenancyId=${id}`).catch(() => null));
  }, []);

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  const balanceFor = (code: string) => balances.find((b) => b.code === code)?.balanceMinor;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Rent outstanding" value={formatINR(balanceFor('RENT_RECEIVABLE'))} accent />
        <Stat label="Arrears total" value={formatINR(arrears?.totalOutstanding)} />
        <Stat
          label="Deposit held"
          value={formatINR(deposit?.balanceHeld.amountMinor)}
          sub={deposit ? titleCase(deposit.status) : undefined}
        />
        <Stat
          label="Tenant advance"
          value={formatINR(balanceFor('TENANT_ADVANCE'))}
          sub={tds?.applicable ? `TDS ${formatINR(tds.amount?.amountMinor)}` : 'No TDS'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Ledger balances"
            action={
              <Link to="/app/t/payments">
                <Button variant="primary" size="sm">
                  Record payment
                </Button>
              </Link>
            }
          >
            <DataTable
              columns={[
                { header: 'Account', render: (b) => titleCase(b.code) },
                { header: 'Type', render: (b) => <span className="text-white/40">{titleCase(b.type)}</span> },
                { header: 'Balance', align: 'right', render: (b) => formatINR(b.balanceMinor) },
              ]}
              rows={balances}
              keyOf={(b) => b.code}
              empty="No postings yet."
            />
          </Card>
        </div>

        <Card title="Arrears ageing">
          <dl className="space-y-2 text-sm">
            {[
              ['0–30 days', arrears?.bucket0to30],
              ['31–60 days', arrears?.bucket31to60],
              ['61–90 days', arrears?.bucket61to90],
              ['90+ days', arrears?.bucket90plus],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="text-white/50">{label}</dt>
                <dd className="tabular-nums text-white/90">{formatINR(val as string | undefined)}</dd>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
              <dt className="text-white/70">Total outstanding</dt>
              <dd className="tabular-nums font-semibold text-white">{formatINR(arrears?.totalOutstanding)}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
