import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { Card, Empty, Field, Pill, Select } from './primitives';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
}

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];

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
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-white/90">{t.title}</p>
                  <div className="mt-1 flex gap-2">
                    <Pill>{titleCase(t.priority)}</Pill>
                    <Pill>{titleCase(t.status)}</Pill>
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
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
