import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { Card, Empty, Pill } from './primitives';

interface Agreement {
  id: string;
  title: string;
  status: string;
  termMonths: number;
  registrationRequired: boolean;
  registrationStatus: string;
}

export function AgreementsTab({ tenancyId }: { tenancyId: string | null }) {
  const [items, setItems] = useState<Agreement[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => {
    setItems(await apiFetch<Agreement[]>(`/tenancies/${id}/agreements`).catch(() => []));
  }, []);

  useEffect(() => {
    if (tenancyId) void load(tenancyId);
  }, [tenancyId, load]);

  async function run(fn: () => Promise<unknown>) {
    if (!tenancyId) return;
    setBusy(true);
    try {
      await fn();
      await load(tenancyId);
    } finally {
      setBusy(false);
    }
  }

  if (!tenancyId) return <Empty>Select a tenancy to manage its agreements.</Empty>;

  return (
    <Card
      title="Rental agreements"
      action={
        <Button
          variant="primary"
          size="sm"
          disabled={busy}
          onClick={() => run(() => apiFetch('/agreements', { method: 'POST', body: JSON.stringify({ tenancyId }) }))}
        >
          New agreement
        </Button>
      }
    >
      {items.length === 0 ? (
        <Empty>No agreements yet — create one from the workspace template.</Empty>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-white/90">{a.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill>{titleCase(a.status)}</Pill>
                  <Pill>{a.termMonths} mo</Pill>
                  {a.registrationRequired && <Pill>Registration: {titleCase(a.registrationStatus)}</Pill>}
                </div>
              </div>
              <div className="flex gap-2">
                {a.status === 'DRAFT' && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => apiFetch(`/agreements/${a.id}/send`, { method: 'POST' }))}>
                    Send
                  </Button>
                )}
                {(a.status === 'OUT_FOR_SIGNATURE' || a.status === 'PARTIALLY_SIGNED') && (
                  <>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => apiFetch(`/agreements/${a.id}/sign`, { method: 'POST', body: JSON.stringify({ partyRole: 'LANDLORD', name: 'Landlord' }) }))}>
                      Sign (landlord)
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => apiFetch(`/agreements/${a.id}/sign`, { method: 'POST', body: JSON.stringify({ partyRole: 'TENANT', name: 'Tenant' }) }))}>
                      Sign (tenant)
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
