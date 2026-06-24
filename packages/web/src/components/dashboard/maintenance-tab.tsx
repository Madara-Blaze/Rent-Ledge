import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { formatINR, rupeesToMinor, titleCase } from '@/lib/format';
import { Card, Empty, Field, Pill, Select } from './primitives';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  costMinor?: string | null;
  costBearer?: string | null;
}

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];
const BEARERS = [
  { value: 'LANDLORD', label: 'Landlord pays' },
  { value: 'TENANT', label: 'Tenant pays (charge back)' },
  { value: 'SPLIT', label: 'Split 50/50' },
];

/** Record a repair cost; tenant-borne (or split) cost charges back to the ledger. */
function CostControl({ ticket, onDone }: { ticket: Ticket; onDone: () => Promise<void> }) {
  const [cost, setCost] = useState('');
  const [bearer, setBearer] = useState('LANDLORD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    if (!cost) return;
    let costMinor: string;
    try {
      costMinor = rupeesToMinor(cost);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid amount');
      return;
    }
    if (bearer !== 'LANDLORD') {
      const effect = bearer === 'TENANT' ? 'the full cost' : 'half the cost';
      if (!window.confirm(`Charge ${effect} (${formatINR(costMinor)}) back to the tenant's ledger? This posts a ledger entry.`)) {
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/maintenance/tickets/${ticket.id}`, {
        method: 'POST',
        body: JSON.stringify({ costMinor, costBearer: bearer }),
      });
      setCost('');
      await onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record cost');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <Field label="Cost (₹)" value={cost} onChange={setCost} placeholder="e.g. 1500" />
        </div>
        <div className="w-52">
          <Select label="Cost borne by" value={bearer} onChange={setBearer} options={BEARERS} />
        </div>
        <Button variant="outline" size="sm" disabled={busy || !cost} onClick={() => void record()}>
          {busy ? 'Saving…' : 'Record cost'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-[#FF0000]">{error}</p>}
    </div>
  );
}

export function MaintenanceTab({ landlordId, tenancyId }: { landlordId: string | null; tenancyId: string | null }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (lid: string) => {
    setTickets(await apiFetch<Ticket[]>(`/workspaces/${lid}/maintenance/tickets`).catch(() => []));
  }, []);

  useEffect(() => {
    if (landlordId) void load(landlordId);
  }, [landlordId, load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      if (landlordId) await load(landlordId);
    } finally {
      setBusy(false);
    }
  }

  const reload = useCallback(async () => {
    if (landlordId) await load(landlordId);
  }, [landlordId, load]);

  if (!landlordId) return <Empty>This is a workspace (landlord) view.</Empty>;

  return (
    <div className="space-y-6">
      <Card title="Raise a ticket">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. Leaking tap in kitchen" />
          </div>
          <Button
            variant="primary"
            disabled={busy || !title || !tenancyId}
            onClick={() =>
              run(async () => {
                await apiFetch(`/tenancies/${tenancyId}/maintenance/tickets`, { method: 'POST', body: JSON.stringify({ title }) });
                setTitle('');
              })
            }
          >
            Create
          </Button>
        </div>
        {!tenancyId && <p className="mt-2 text-xs text-white/30">Select a tenancy to attach the ticket.</p>}
      </Card>

      <Card title="Tickets">
        {tickets.length === 0 ? (
          <Empty>No maintenance tickets.</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {tickets.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/90">{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Pill>{titleCase(t.priority)}</Pill>
                      <Pill>{titleCase(t.status)}</Pill>
                      {t.costMinor && t.costMinor !== '0' && (
                        <span className="text-xs text-white/40">
                          {formatINR(t.costMinor)}
                          {t.costBearer ? ` · ${titleCase(t.costBearer)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-44">
                    <Select
                      label="Set status"
                      value={t.status}
                      onChange={(status) => run(() => apiFetch(`/maintenance/tickets/${t.id}`, { method: 'POST', body: JSON.stringify({ status }) }))}
                      options={STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
                    />
                  </div>
                </div>
                <CostControl ticket={t} onDone={reload} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
