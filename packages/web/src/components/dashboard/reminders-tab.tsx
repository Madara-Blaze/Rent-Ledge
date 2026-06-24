import { BellRing, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { formatINR, titleCase } from '@/lib/format';
import { Card, Empty, Pill, Stat } from './primitives';

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

export function RemindersTab({ landlordId }: { landlordId: string | null }) {
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null); // 'ALL' | tenancyId
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async (lid: string) => {
    setLoading(true);
    try {
      setItems(await apiFetch<ReminderItem[]>(`/workspaces/${lid}/reminders/preview`).catch(() => []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  if (!landlordId) return <Empty>This is a workspace (landlord) view.</Empty>;

  const sendableCount = items.filter((i) => !i.alreadySentToday && i.channel).length;
  const overdue = items.filter((i) => i.bucket === 'OVERDUE').length;
  const totalOutstanding = items.reduce((acc, i) => acc + BigInt(i.outstandingMinor || '0'), 0n);

  async function sendAll() {
    if (!landlordId) return;
    if (!window.confirm(`Send ${sendableCount} rent reminder(s) now? Tenants will be contacted via WhatsApp/SMS/email.`)) {
      return;
    }
    setSending('ALL');
    setFlash(null);
    try {
      const r = await apiFetch<SendResult>(`/workspaces/${landlordId}/reminders/send`, { method: 'POST' });
      setFlash(`Sent ${r.sent}. Skipped ${r.skippedAlreadySent} already-sent, ${r.skippedNoContact} with no contact.`);
      await load(landlordId);
    } catch (e) {
      setFlash(e instanceof ApiError ? e.message : 'Send failed');
    } finally {
      setSending(null);
    }
  }

  async function sendOne(item: ReminderItem) {
    if (!window.confirm(`Send a rent reminder to ${item.tenantName} (${item.recipient})?`)) return;
    setSending(item.tenancyId);
    setFlash(null);
    try {
      const r = await apiFetch<SendResult>(`/tenancies/${item.tenancyId}/reminders/send`, { method: 'POST' });
      setFlash(`Sent ${r.sent} reminder(s) to ${item.tenantName}.`);
      if (landlordId) await load(landlordId);
    } catch (e) {
      setFlash(e instanceof ApiError ? e.message : 'Send failed');
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Due / overdue" value={String(items.length)} sub={`${overdue} overdue`} accent />
        <Stat label="Total outstanding" value={formatINR(totalOutstanding.toString())} />
        <Stat label="Ready to send" value={String(sendableCount)} sub="Not yet sent today" />
      </div>

      <Card
        title="Rent reminders"
        action={
          <Button variant="primary" size="sm" disabled={sending !== null || sendableCount === 0} onClick={() => void sendAll()}>
            <BellRing className="size-4" /> {sending === 'ALL' ? 'Sending…' : `Send all due (${sendableCount})`}
          </Button>
        }
      >
        {flash && <p className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">{flash}</p>}
        {loading && items.length === 0 ? (
          <Empty>Loading…</Empty>
        ) : items.length === 0 ? (
          <Empty>Nothing due — no overdue or upcoming rent in the reminder window.</Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tenant</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.invoiceId} className="border-t border-white/[0.06]">
                    <td className="px-4 py-2.5 text-white/80">
                      {i.tenantName}
                      <span className="ml-2 text-xs text-white/30">{i.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={i.bucket === 'OVERDUE' ? 'text-[#FF6b6b]' : 'text-white/60'}>{i.dueDate}</span>
                      <span className="ml-2 text-xs text-white/30">{titleCase(i.bucket)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white/90">{formatINR(i.outstandingMinor)}</td>
                    <td className="px-4 py-2.5">
                      {i.channel ? <Pill>{titleCase(i.channel)}</Pill> : <span className="text-xs text-white/30">No contact</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {i.alreadySentToday ? (
                        <span className="text-xs text-emerald-400/80">Sent today</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={sending !== null || !i.channel}
                          onClick={() => void sendOne(i)}
                        >
                          <Send className="size-3.5" /> Send
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-white/30">
          Reminders are idempotent — re-sending the same day won't double-message a tenant. Delivery uses a mock channel in
          dev; swap in WhatsApp/SMS/email behind the same adapter for production.
        </p>
      </Card>
    </div>
  );
}
