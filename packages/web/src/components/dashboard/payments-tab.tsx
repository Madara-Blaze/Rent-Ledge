import { Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiDownload, apiFetch } from '@/lib/api';
import { formatINR, titleCase } from '@/lib/format';
import { Card, Empty } from './primitives';

interface Payment {
  id: string;
  method: string;
  amountMinor: string;
  tdsMinor: string;
  currency: string;
  status: string;
  reference: string | null;
  receivedAt: string;
}

export function PaymentsTab({ tenancyId }: { tenancyId: string | null }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setPayments(await apiFetch<Payment[]>(`/tenancies/${id}/payments`).catch(() => []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenancyId) void load(tenancyId);
  }, [tenancyId, load]);

  if (!tenancyId) return <Empty>Select a tenancy to view payment history.</Empty>;

  return (
    <Card title="Payment history">
      {loading && payments.length === 0 ? (
        <Empty>Loading…</Empty>
      ) : payments.length === 0 ? (
        <Empty>No payments recorded yet.</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Method</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">TDS</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.06]">
                  <td className="px-4 py-2.5 text-white/80">{p.receivedAt?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-white/60">{titleCase(p.method)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white/90">{formatINR(p.amountMinor)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white/40">
                    {p.tdsMinor && p.tdsMinor !== '0' ? formatINR(p.tdsMinor) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-white/60">{titleCase(p.status)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void apiDownload(`/payments/${p.id}/receipt.pdf`, `rent-receipt-${p.id.slice(0, 8)}.pdf`)}
                    >
                      <Download className="size-3.5" /> PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-white/30">Receipts are HRA-ready (include landlord PAN when on file).</p>
    </Card>
  );
}
