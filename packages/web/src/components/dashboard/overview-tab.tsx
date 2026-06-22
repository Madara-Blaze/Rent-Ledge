import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatINR, titleCase } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, Empty, Field, Stat } from './primitives';

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

export function OverviewTab({ tenancyId }: { tenancyId: string | null }) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [arrears, setArrears] = useState<Arrears | null>(null);
  const [deposit, setDeposit] = useState<DepositStatement | null>(null);
  const [tds, setTds] = useState<TdsPreview | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async (id: string) => {
    const [b, a] = await Promise.all([
      apiFetch<Balance[]>(`/tenancies/${id}/ledger`),
      apiFetch<Arrears>(`/tenancies/${id}/arrears`),
    ]);
    setBalances(b);
    setArrears(a);
    setDeposit(await apiFetch<DepositStatement>(`/deposits/${id}/statement`).catch(() => null));
    setTds(await apiFetch<TdsPreview>(`/tax/tds/preview?tenancyId=${id}`).catch(() => null));
  }, []);

  useEffect(() => {
    if (tenancyId) void load(tenancyId);
  }, [tenancyId, load]);

  const balanceFor = (code: string) => balances.find((b) => b.code === code)?.balanceMinor;

  async function recordPayment() {
    if (!tenancyId || !payAmount) return;
    setPaying(true);
    try {
      await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({ tenancyId, amountMinor: String(Math.round(Number(payAmount) * 100)), method: 'UPI' }),
      });
      setPayAmount('');
      await load(tenancyId);
    } finally {
      setPaying(false);
    }
  }

  if (!tenancyId) return <Empty>Select a tenancy to view its finances.</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Rent outstanding" value={formatINR(balanceFor('RENT_RECEIVABLE'))} accent />
        <Stat label="Arrears total" value={formatINR(arrears?.totalOutstanding)} />
        <Stat label="Deposit held" value={formatINR(deposit?.balanceHeld.amountMinor)} sub={deposit ? titleCase(deposit.status) : undefined} />
        <Stat label="TDS (annual)" value={tds?.applicable ? formatINR(tds.amount?.amountMinor) : 'N/A'} sub={tds?.section ? `§${tds.section}` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Ledger balances">
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Account</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-white/30">No postings yet</td>
                    </tr>
                  )}
                  {balances.map((b) => (
                    <tr key={b.code} className="border-t border-white/[0.06]">
                      <td className="px-4 py-2.5 text-white/80">{titleCase(b.code)}</td>
                      <td className="px-4 py-2.5 text-white/40">{titleCase(b.type)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-white">{formatINR(b.balanceMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Record a payment">
            <Field label="Amount (₹)" value={payAmount} onChange={setPayAmount} placeholder="e.g. 55000" />
            <Button variant="primary" className="mt-3 w-full" disabled={paying || !payAmount} onClick={() => void recordPayment()}>
              {paying ? 'Recording…' : 'Record UPI payment'}
            </Button>
            <p className="mt-3 text-xs text-white/30">Auto-allocates to the oldest open invoice; posts to the ledger.</p>
          </Card>
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
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
