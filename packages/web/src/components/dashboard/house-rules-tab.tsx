import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Card, Empty, Pill } from './primitives';

interface CurrentRules {
  current: { id: string; version: number; body: string } | null;
  acknowledged: boolean;
}

export function HouseRulesTab({ landlordId, tenancyId }: { landlordId: string | null; tenancyId: string | null }) {
  const [data, setData] = useState<CurrentRules | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => {
    setData(await apiFetch<CurrentRules>(`/tenancies/${id}/house-rules`).catch(() => ({ current: null, acknowledged: false })));
  }, []);

  useEffect(() => {
    if (tenancyId) void load(tenancyId);
  }, [tenancyId, load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      if (tenancyId) await load(tenancyId);
    } finally {
      setBusy(false);
    }
  }

  if (!tenancyId) return <Empty>Select a tenancy to view its house rules.</Empty>;

  return (
    <div className="space-y-6">
      <Card
        title="Current house rules"
        action={data?.current ? <Pill>{data.acknowledged ? 'Acknowledged' : 'Not acknowledged'} · v{data.current.version}</Pill> : null}
      >
        {data?.current ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{data.current.body}</p>
            {!data.acknowledged && (
              <Button
                variant="primary"
                className="mt-4"
                disabled={busy}
                onClick={() => run(() => apiFetch(`/house-rules/${data.current!.id}/acknowledge`, { method: 'POST', body: JSON.stringify({ tenancyId }) }))}
              >
                Acknowledge
              </Button>
            )}
          </>
        ) : (
          <Empty>No house rules published yet.</Empty>
        )}
      </Card>

      {landlordId && (
        <Card title="Publish a new version">
          <textarea
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="House rules text…"
            aria-label="House rules text"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#FF0000]/60"
          />
          <Button
            variant="outline"
            className="mt-3"
            disabled={busy || !draft}
            onClick={() =>
              run(async () => {
                await apiFetch(`/workspaces/${landlordId}/house-rules`, { method: 'POST', body: JSON.stringify({ body: draft }) });
                setDraft('');
              })
            }
          >
            Publish version
          </Button>
        </Card>
      )}
    </div>
  );
}
