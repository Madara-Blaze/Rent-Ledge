import { Download, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  Empty,
  ErrorText,
  Field,
  KeyValue,
  Modal,
  MoneyField,
  PageHeader,
  Select,
  StatusBadge,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiDownload, apiFetch } from '@/lib/api';
import { formatINR, rupeesToMinor, shortId, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

const METHODS = ['UPI', 'CARD', 'NETBANKING', 'CASH', 'CHEQUE', 'BANK_TRANSFER', 'ADJUSTMENT'];

interface Money {
  amountMinor: string;
  currency: string;
}
interface Allocation {
  invoiceId: string;
  amount: Money;
}
interface Payment {
  id: string;
  tenancyId: string;
  method: string;
  amount: Money;
  tds: Money;
  status: string;
  allocations: Allocation[];
  advance: Money;
  journalEntryId?: string | null;
}
interface PaymentHistoryRow {
  id: string;
  method: string;
  amountMinor: string;
  tdsMinor: string;
  status: string;
  reference: string | null;
  receivedAt: string;
}

export function PaymentsPage() {
  const { canManage } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="Payments"
        description="Record manual or gateway payments. Amounts auto-allocate oldest-first; overpayment rolls into advance."
      />
      <TenancyGate>{({ tenancyId }) => <PaymentsBody tenancyId={tenancyId} canManage={canManage} />}</TenancyGate>
    </div>
  );
}

function PaymentsBody({ tenancyId, canManage }: { tenancyId: string; canManage: boolean }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [tds, setTds] = useState('');
  const [reference, setReference] = useState('');
  const [allocs, setAllocs] = useState<{ invoiceId: string; amount: string }[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<PaymentHistoryRow[]>([]);
  const { busy, error, setError, run } = useRun();

  const loadHistory = useCallback(async () => {
    setHistory(await apiFetch<PaymentHistoryRow[]>(`/tenancies/${tenancyId}/payments`).catch(() => []));
  }, [tenancyId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function validateAndOpen() {
    setError(null);
    if (!rupeesToMinor(amount)) {
      setError('Enter a valid payment amount.');
      return;
    }
    if (tds && !rupeesToMinor(tds)) {
      setError('Enter a valid TDS amount.');
      return;
    }
    for (const a of allocs) {
      if (!a.invoiceId || !rupeesToMinor(a.amount)) {
        setError('Each allocation needs an invoice ID and a valid amount.');
        return;
      }
    }
    setConfirm(true);
  }

  async function record() {
    const amountMinor = rupeesToMinor(amount)!;
    const tdsMinor = tds ? rupeesToMinor(tds)! : undefined;
    const allocations = allocs.length
      ? allocs.map((a) => ({ invoiceId: a.invoiceId, amountMinor: rupeesToMinor(a.amount)! }))
      : undefined;
    const idempotencyKey = crypto.randomUUID();
    const ok = await run(async () => {
      const res = await apiFetch<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          tenancyId,
          amountMinor,
          method,
          tdsMinor,
          allocations,
          reference: reference || undefined,
          idempotencyKey,
        }),
      });
      setPayments((prev) => [res, ...prev]);
      await loadHistory();
    });
    if (ok) {
      setConfirm(false);
      setAmount('');
      setTds('');
      setReference('');
      setAllocs([]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canManage ? (
          <Card title="Record a payment">
            <div className="grid grid-cols-2 gap-3">
              <MoneyField label="Amount received" value={amount} onChange={setAmount} />
              <Select label="Method" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: titleCase(m) }))} />
              <MoneyField label="TDS withheld (optional)" value={tds} onChange={setTds} hint="Tenant-withheld TDS, if any" />
              <Field label="Reference (optional)" value={reference} onChange={setReference} placeholder="UTR / cheque no." />
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-white/40">Manual allocations (optional)</span>
                <Button variant="ghost" size="sm" onClick={() => setAllocs((a) => [...a, { invoiceId: '', amount: '' }])}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>
              {allocs.length === 0 ? (
                <p className="text-xs text-white/30">Leave empty to auto-allocate to the oldest open invoices first.</p>
              ) : (
                <div className="space-y-2">
                  {allocs.map((a, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="flex-1">
                        <Field
                          label="Invoice ID"
                          value={a.invoiceId}
                          onChange={(v) => setAllocs((prev) => prev.map((x, xi) => (xi === i ? { ...x, invoiceId: v } : x)))}
                        />
                      </div>
                      <div className="w-32">
                        <MoneyField
                          label="Amount"
                          value={a.amount}
                          onChange={(v) => setAllocs((prev) => prev.map((x, xi) => (xi === i ? { ...x, amount: v } : x)))}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setAllocs((prev) => prev.filter((_, xi) => xi !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button variant="primary" className="mt-4 w-full" disabled={busy || !amount} onClick={validateAndOpen}>
              Review payment
            </Button>
            <ErrorText>{error}</ErrorText>
          </Card>
        ) : (
          <Card title="Record a payment">
            <Banner tone="blue">Your role has read-only access to payments.</Banner>
          </Card>
        )}

        <Card title="Recorded this session">
          {payments.length === 0 ? (
            <Empty>No payments recorded yet.</Empty>
          ) : (
            <div className="space-y-4">
              {payments.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-white">{formatINR(p.amount.amountMinor)}</span>
                    <div className="flex items-center gap-2">
                      <Badge tone="blue">{titleCase(p.method)}</Badge>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <KeyValue
                    items={[
                      ['TDS withheld', formatINR(p.tds.amountMinor)],
                      ['Advance rolled forward', formatINR(p.advance.amountMinor)],
                      ['Allocations', p.allocations.length ? `${p.allocations.length}` : 'Auto'],
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Allocation detail">
        <DataTable
          columns={[
            { header: 'Payment', render: (p: Payment) => <span className="font-mono text-xs">{shortId(p.id)}</span> },
            { header: 'Allocated to', render: (p: Payment) => (p.allocations.length ? p.allocations.map((a) => shortId(a.invoiceId)).join(', ') : 'Oldest-first (auto)') },
            { header: 'Advance', align: 'right', render: (p: Payment) => formatINR(p.advance.amountMinor) },
          ]}
          rows={payments}
          keyOf={(p) => p.id}
          empty="Allocations appear here after recording a payment."
        />
      </Card>

      <Card title="Payment history & receipts">
        <DataTable
          columns={[
            { header: 'Date', render: (p: PaymentHistoryRow) => p.receivedAt?.slice(0, 10) },
            { header: 'Method', render: (p: PaymentHistoryRow) => titleCase(p.method) },
            { header: 'Amount', align: 'right', render: (p: PaymentHistoryRow) => formatINR(p.amountMinor) },
            {
              header: 'TDS',
              align: 'right',
              render: (p: PaymentHistoryRow) => (p.tdsMinor && p.tdsMinor !== '0' ? formatINR(p.tdsMinor) : '—'),
            },
            { header: 'Status', render: (p: PaymentHistoryRow) => <StatusBadge status={p.status} /> },
            {
              header: 'Receipt',
              align: 'right',
              render: (p: PaymentHistoryRow) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void apiDownload(`/payments/${p.id}/receipt.pdf`, `rent-receipt-${shortId(p.id)}.pdf`)}
                >
                  <Download className="size-3.5" /> PDF
                </Button>
              ),
            },
          ]}
          rows={history}
          keyOf={(p) => p.id}
          empty="No payments recorded yet."
        />
        <p className="mt-3 text-xs text-white/30">Receipts are HRA-ready and include the landlord PAN when on file.</p>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm payment"
        description="This posts to the immutable double-entry ledger and cannot be edited — only reversed."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void record()}>
              {busy ? 'Posting…' : 'Confirm & post'}
            </Button>
          </>
        }
      >
        <KeyValue
          items={[
            ['Tenancy', shortId(tenancyId)],
            ['Amount received', formatINR(rupeesToMinor(amount) ?? undefined)],
            ['Method', titleCase(method)],
            ['TDS withheld', tds ? formatINR(rupeesToMinor(tds) ?? undefined) : '—'],
            ['Allocation', allocs.length ? `${allocs.length} manual` : 'Auto (oldest-first)'],
          ]}
        />
        <ErrorText>{error}</ErrorText>
      </Modal>
    </div>
  );
}
