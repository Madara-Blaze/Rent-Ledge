import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { Card, Empty, Field, Pill, Select } from './primitives';

interface Notice {
  id: string;
  type: string;
  subject: string;
  status: string;
  effectiveDate: string | null;
  minNoticeDays: number;
}

const NOTICE_TYPES = ['RENT_REMINDER', 'PAYMENT_DEFAULT', 'RENT_INCREASE', 'RENEWAL_OFFER', 'TERMINATION', 'DEPOSIT_DEDUCTION', 'EVICTION'];

export function NoticesTab({ tenancyId }: { tenancyId: string | null }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [type, setType] = useState('RENT_REMINDER');
  const [subject, setSubject] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => {
    setItems(await apiFetch<Notice[]>(`/tenancies/${id}/notices`).catch(() => []));
  }, []);

  useEffect(() => {
    if (tenancyId) void load(tenancyId);
  }, [tenancyId, load]);

  async function run(fn: () => Promise<unknown>) {
    if (!tenancyId) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load(tenancyId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (!tenancyId) return <Empty>Select a tenancy to manage notices.</Empty>;

  return (
    <div className="space-y-6">
      <Card title="Draft a notice">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Type" value={type} onChange={setType} options={NOTICE_TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
          <Field label="Effective date (optional)" type="date" value={effectiveDate} onChange={setEffectiveDate} />
          <div className="sm:col-span-2">
            <Field label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Rent due reminder for July" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-[#ff6b6b]">{error}</p>}
        <Button
          variant="primary"
          className="mt-4"
          disabled={busy || !subject}
          onClick={() =>
            run(async () => {
              await apiFetch('/notices', {
                method: 'POST',
                body: JSON.stringify({ tenancyId, type, subject, body: subject, effectiveDate: effectiveDate || undefined }),
              });
              setSubject('');
              setEffectiveDate('');
            })
          }
        >
          Create draft
        </Button>
      </Card>

      <Card title="Notices">
        {items.length === 0 ? (
          <Empty>No notices yet.</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-white/90">{n.subject}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Pill>{titleCase(n.type)}</Pill>
                    <Pill>{titleCase(n.status)}</Pill>
                    {n.minNoticeDays > 0 && <Pill>{n.minNoticeDays}d notice</Pill>}
                  </div>
                </div>
                {n.status === 'DRAFT' && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => apiFetch(`/notices/${n.id}/send`, { method: 'POST', body: JSON.stringify({ channel: 'EMAIL' }) }))}>
                    Send
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
