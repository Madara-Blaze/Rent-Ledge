import { useCallback, useEffect, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  Field,
  PageHeader,
  Select,
  Textarea,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDate, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface Inspection {
  id: string;
  type: string;
  conditionNotes: string | null;
  conductedAt: string;
  createdAt: string;
}

export function InspectionsPage() {
  const { canManage } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="Inspections"
        description="Move-in and move-out inspections — notes and evidence that underpin fair deposit settlement."
      />
      <TenancyGate>{({ tenancyId }) => <InspectionsBody tenancyId={tenancyId} canManage={canManage} />}</TenancyGate>
    </div>
  );
}

function InspectionsBody({ tenancyId, canManage }: { tenancyId: string; canManage: boolean }) {
  const [items, setItems] = useState<Inspection[]>([]);
  const [type, setType] = useState('MOVE_IN');
  const [notes, setNotes] = useState('');
  const [conductedAt, setConductedAt] = useState('');
  const create = useRun();

  const load = useCallback(async (id: string) => {
    setItems(await apiFetch<Inspection[]>(`/tenancies/${id}/inspections`).catch(() => []));
  }, []);

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  async function record() {
    const ok = await create.run(() =>
      apiFetch(`/tenancies/${tenancyId}/inspections`, {
        method: 'POST',
        body: JSON.stringify({ type, conditionNotes: notes || undefined, conductedAt: conductedAt || undefined }),
      }),
    );
    if (ok) {
      setNotes('');
      setConductedAt('');
      await load(tenancyId);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {canManage && (
        <Card title="Record inspection">
          <div className="space-y-3">
            <Select
              label="Type"
              value={type}
              onChange={setType}
              options={[
                { value: 'MOVE_IN', label: 'Move-in' },
                { value: 'MOVE_OUT', label: 'Move-out' },
              ]}
            />
            <Field label="Conducted at (optional)" type="date" value={conductedAt} onChange={setConductedAt} />
            <Textarea label="Condition notes" value={notes} onChange={setNotes} rows={4} placeholder="Observed condition, fixtures, meter readings…" />
            <Button variant="primary" size="sm" className="w-full" disabled={create.busy} onClick={() => void record()}>
              {create.busy ? 'Recording…' : 'Record inspection'}
            </Button>
            <ErrorText>{create.error}</ErrorText>
          </div>
        </Card>
      )}

      <div className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
        <Card title="Inspection history">
          {items.length === 0 ? (
            <Empty>No inspections recorded yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.id} className="rounded-xl border border-white/10 p-4">
                  <div className="flex items-center justify-between">
                    <Badge tone={i.type === 'MOVE_IN' ? 'green' : 'amber'}>{titleCase(i.type)}</Badge>
                    <span className="text-xs text-white/40">{formatDate(i.conductedAt)}</span>
                  </div>
                  {i.conditionNotes && <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{i.conditionNotes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
