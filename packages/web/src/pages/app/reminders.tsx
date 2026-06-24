import { BellRing, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  ErrorText,
  KeyValue,
  Modal,
  PageHeader,
  Stat,
  toneFor,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatINR, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface ReminderItem {
  tenancyId: string;
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  dueDate: string;
  outstandingMinor: string;
  bucket: 'OVERDUE' | 'DUE_SOON';
  channel: string | null;
  recipient: string | null;
  alreadySentToday: boolean;
}
interface SendResult {
  sent: number;
  skippedAlreadySent: number;
  skippedNoContact: number;
}

type Pending = { scope: 'ALL' } | { scope: 'TENANCY'; item: ReminderItem } | null;

export function RemindersPage() {
  const { landlordId, canManage } = useWorkspace();
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const { busy, error, setError, run } = useRun();

  const load = useCallback(async (lid: string) => {
    setItems(await apiFetch<ReminderItem[]>(`/workspaces/${lid}/reminders/preview`).catch(() => []));
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Rent reminders" />
        <Banner tone="blue">Reminders are sent from the landlord workspace.</Banner>
      </div>
    );
  }

  const sendable = items.filter((i) => !i.alreadySentToday && i.channel).length;
  const overdue = items.filter((i) => i.bucket === 'OVERDUE').length;
  const totalOutstanding = items.reduce((acc, i) => acc + BigInt(i.outstandingMinor || '0'), 0n);

  async function confirmSend() {
    if (!landlordId || !pending) return;
    const path =
      pending.scope === 'ALL'
        ? `/workspaces/${landlordId}/reminders/send`
        : `/tenancies/${pending.item.tenancyId}/reminders/send`;
    const ok = await run(async () => {
      const r = await apiFetch<SendResult>(path, { method: 'POST' });
      setFlash(`Sent ${r.sent}. Skipped ${r.skippedAlreadySent} already-sent today, ${r.skippedNoContact} with no contact.`);
      await load(landlordId);
    });
    if (ok) setPending(null);
  }

  return (
    <div>
      <PageHeader
        title="Rent reminders"
        description="Rent overdue or due soon. Reminders are idempotent — re-sending the same day won't double-message a tenant."
        actions={
          canManage ? (
            <Button variant="primary" size="sm" disabled={sendable === 0} onClick={() => { setError(null); setPending({ scope: 'ALL' }); }}>
              <BellRing className="size-4" /> Send all due ({sendable})
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Due / overdue" value={String(items.length)} sub={`${overdue} overdue`} accent />
        <Stat label="Total outstanding" value={formatINR(totalOutstanding.toString())} />
        <Stat label="Ready to send" value={String(sendable)} sub="Not yet sent today" />
      </div>

      {flash && (
        <div className="mb-4">
          <Banner tone="green">{flash}</Banner>
        </div>
      )}

      <Card title="Reminder queue">
        <DataTable
          columns={[
            {
              header: 'Tenant',
              render: (i: ReminderItem) => (
                <span>
                  {i.tenantName} <span className="ml-1 text-xs text-white/30">{i.invoiceNumber}</span>
                </span>
              ),
            },
            {
              header: 'Due',
              render: (i: ReminderItem) => (
                <span className="flex items-center gap-2">
                  <span className={i.bucket === 'OVERDUE' ? 'text-[#ff8f8f]' : 'text-white/70'}>{i.dueDate}</span>
                  <Badge tone={toneFor(i.bucket === 'OVERDUE' ? 'OVERDUE' : 'PENDING')}>{titleCase(i.bucket)}</Badge>
                </span>
              ),
            },
            { header: 'Outstanding', align: 'right', render: (i: ReminderItem) => formatINR(i.outstandingMinor) },
            {
              header: 'Channel',
              render: (i: ReminderItem) => (i.channel ? titleCase(i.channel) : <span className="text-white/30">No contact</span>),
            },
            {
              header: '',
              align: 'right',
              render: (i: ReminderItem) =>
                i.alreadySentToday ? (
                  <Badge tone="green">Sent today</Badge>
                ) : canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!i.channel}
                    onClick={() => { setError(null); setPending({ scope: 'TENANCY', item: i }); }}
                  >
                    <Send className="size-3.5" /> Send
                  </Button>
                ) : null,
            },
          ]}
          rows={items}
          keyOf={(i) => i.invoiceId}
          empty="Nothing due — no overdue or upcoming rent in the reminder window."
        />
        <p className="mt-3 text-xs text-white/30">
          Delivery uses a mock channel in dev; swap in WhatsApp/SMS/email behind the same adapter for production.
        </p>
      </Card>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Send rent reminders"
        description="Tenants will be contacted via WhatsApp/SMS/email. This is logged and idempotent per invoice per day."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void confirmSend()}>
              {busy ? 'Sending…' : 'Confirm & send'}
            </Button>
          </>
        }
      >
        <KeyValue
          items={
            pending?.scope === 'TENANCY'
              ? [
                  ['Tenant', pending.item.tenantName],
                  ['Channel', pending.item.channel ? titleCase(pending.item.channel) : '—'],
                  ['Outstanding', formatINR(pending.item.outstandingMinor)],
                ]
              : [
                  ['Reminders to send', String(sendable)],
                  ['Total outstanding', formatINR(totalOutstanding.toString())],
                ]
          }
        />
        <ErrorText>{error}</ErrorText>
      </Modal>
    </div>
  );
}
