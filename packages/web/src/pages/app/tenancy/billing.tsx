import { useState } from 'react';
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
  PageHeader,
  StatusBadge,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDate, formatINR, shortId, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface Money {
  amountMinor: string;
  currency: string;
}
interface Preview {
  baseRent: Money;
  escalatedRent: Money;
  escalationPeriodsApplied: number;
  chargeableDays: number;
  totalDays: number;
  prorationBasis: string;
  amount: Money;
}
interface Invoice {
  id: string;
  number: string;
  kind: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate: string;
  amount: Money;
  status: string;
  journalEntryId?: string | null;
}
interface LateFeeResult {
  applied: boolean;
  daysLate: number;
  chargeableDays: number;
  fee: Money;
  invoice?: Invoice;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function BillingPage() {
  const { canManage } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="Rent & billing"
        description="Issue rent invoices with proration and escalation. Always preview the breakdown before posting."
      />
      <TenancyGate>{({ tenancyId }) => <BillingBody tenancyId={tenancyId} canManage={canManage} />}</TenancyGate>
    </div>
  );
}

function BillingBody({ tenancyId, canManage }: { tenancyId: string; canManage: boolean }) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [periodStart, setPeriodStart] = useState(iso(firstDay));
  const [periodEnd, setPeriodEnd] = useState(iso(lastDay));
  const [dueDate, setDueDate] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 5)));
  const [occupancyStart, setOccupancyStart] = useState('');
  const [occupancyEnd, setOccupancyEnd] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const previewRun = useRun();
  const issueRun = useRun();

  // late fee
  const [lateInvoiceId, setLateInvoiceId] = useState('');
  const [lateAsOf, setLateAsOf] = useState('');
  const [lateResult, setLateResult] = useState<LateFeeResult | null>(null);
  const lateRun = useRun();

  function body() {
    return {
      tenancyId,
      periodStart,
      periodEnd,
      dueDate,
      occupancyStart: occupancyStart || undefined,
      occupancyEnd: occupancyEnd || undefined,
    };
  }

  async function doPreview() {
    setPreview(null);
    await previewRun.run(async () => {
      setPreview(await apiFetch<Preview>('/invoices/preview', { method: 'POST', body: JSON.stringify(body()) }));
    });
  }

  async function doIssue() {
    const ok = await issueRun.run(async () => {
      const inv = await apiFetch<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(body()) });
      setInvoices((prev) => [inv, ...prev]);
      setLateInvoiceId(inv.id);
    });
    if (ok) setPreview(null);
  }

  async function applyLateFee() {
    setLateResult(null);
    await lateRun.run(async () => {
      const res = await apiFetch<LateFeeResult>('/invoices/late-fee', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: lateInvoiceId, asOf: lateAsOf || undefined }),
      });
      setLateResult(res);
      if (res.invoice) {
        setInvoices((prev) => prev.map((i) => (i.id === res.invoice!.id ? res.invoice! : i)));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Rent invoice" description="Proration and escalation are computed by the platform.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start" type="date" value={periodStart} onChange={setPeriodStart} />
            <Field label="Period end" type="date" value={periodEnd} onChange={setPeriodEnd} />
            <Field label="Due date" type="date" value={dueDate} onChange={setDueDate} />
            <div />
            <Field label="Occupancy start" type="date" value={occupancyStart} onChange={setOccupancyStart} hint="Mid-month move-in" />
            <Field label="Occupancy end" type="date" value={occupancyEnd} onChange={setOccupancyEnd} hint="Mid-month move-out" />
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" disabled={previewRun.busy} onClick={() => void doPreview()}>
              {previewRun.busy ? 'Previewing…' : 'Preview breakdown'}
            </Button>
            {canManage && preview && (
              <Button variant="primary" size="sm" disabled={issueRun.busy} onClick={() => void doIssue()}>
                {issueRun.busy ? 'Issuing…' : `Issue invoice · ${formatINR(preview.amount.amountMinor)}`}
              </Button>
            )}
          </div>
          <ErrorText>{previewRun.error ?? issueRun.error}</ErrorText>
        </Card>

        <Card title="Preview">
          {preview ? (
            <KeyValue
              items={[
                ['Base rent', formatINR(preview.baseRent.amountMinor)],
                ['Escalated rent', formatINR(preview.escalatedRent.amountMinor)],
                ['Escalation periods', String(preview.escalationPeriodsApplied)],
                ['Chargeable days', `${preview.chargeableDays} / ${preview.totalDays}`],
                ['Proration basis', titleCase(preview.prorationBasis)],
                ['Invoice amount', <span className="font-semibold text-white">{formatINR(preview.amount.amountMinor)}</span>],
              ]}
            />
          ) : (
            <Empty>Run a preview to see the proration and escalation breakdown.</Empty>
          )}
        </Card>
      </div>

      <Card title="Invoices issued this session" description="The API does not expose a historical invoice list; these are invoices you created here.">
        <DataTable
          columns={[
            { header: 'Number', render: (i: Invoice) => <span className="font-mono text-xs">{i.number}</span> },
            { header: 'Kind', render: (i: Invoice) => <Badge tone="blue">{titleCase(i.kind)}</Badge> },
            { header: 'Due', render: (i: Invoice) => formatDate(i.dueDate) },
            { header: 'Status', render: (i: Invoice) => <StatusBadge status={i.status} /> },
            { header: 'Amount', align: 'right', render: (i: Invoice) => formatINR(i.amount.amountMinor) },
          ]}
          rows={invoices}
          keyOf={(i) => i.id}
          empty="No invoices issued yet in this session."
        />
      </Card>

      {canManage && (
        <Card title="Apply a late fee" description="Policy-driven (grace period, flat / %-of-outstanding / per-day, capped).">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Invoice ID" value={lateInvoiceId} onChange={setLateInvoiceId} placeholder="Invoice UUID" />
            <Field label="As of (optional)" type="date" value={lateAsOf} onChange={setLateAsOf} />
          </div>
          <Button variant="primary" size="sm" className="mt-3" disabled={lateRun.busy || !lateInvoiceId} onClick={() => void applyLateFee()}>
            {lateRun.busy ? 'Calculating…' : 'Apply late fee'}
          </Button>
          <ErrorText>{lateRun.error}</ErrorText>
          {lateResult && (
            <div className="mt-4">
              {lateResult.applied ? (
                <Banner tone="amber">
                  Late fee of <span className="font-semibold">{formatINR(lateResult.fee.amountMinor)}</span> applied —{' '}
                  {lateResult.daysLate} days late ({lateResult.chargeableDays} chargeable).
                  {lateResult.invoice && ` Invoice ${shortId(lateResult.invoice.id)} now ${titleCase(lateResult.invoice.status)}.`}
                </Banner>
              ) : (
                <Banner tone="green">No late fee due — within the grace period ({lateResult.daysLate} days late).</Banner>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
