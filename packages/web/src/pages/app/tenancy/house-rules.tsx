import { useCallback, useEffect, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Banner,
  Card,
  DataTable,
  Empty,
  ErrorText,
  PageHeader,
  Pill,
  Select,
  Textarea,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface CurrentRules {
  current: { id: string; version: number; body: string } | null;
  acknowledged: boolean;
}
interface RulesVersion {
  id: string;
  version: number;
  body: string;
  propertyId: string | null;
  createdAt: string;
}

export function HouseRulesPage() {
  const { canManage, landlordId, properties } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="House rules"
        description="Versioned per-property rules with timestamped tenant acknowledgement; re-acknowledged on change."
      />
      <TenancyGate>
        {({ tenancyId }) => <HouseRulesBody tenancyId={tenancyId} canManage={canManage} landlordId={landlordId} properties={properties} />}
      </TenancyGate>
    </div>
  );
}

function HouseRulesBody({
  tenancyId,
  canManage,
  landlordId,
  properties,
}: {
  tenancyId: string;
  canManage: boolean;
  landlordId: string | null;
  properties: { id: string; name: string }[];
}) {
  const [data, setData] = useState<CurrentRules | null>(null);
  const [versions, setVersions] = useState<RulesVersion[]>([]);
  const [draft, setDraft] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const ack = useRun();
  const publish = useRun();

  const load = useCallback(
    async (id: string) => {
      setData(await apiFetch<CurrentRules>(`/tenancies/${id}/house-rules`).catch(() => ({ current: null, acknowledged: false })));
      if (landlordId) setVersions(await apiFetch<RulesVersion[]>(`/workspaces/${landlordId}/house-rules`).catch(() => []));
    },
    [landlordId],
  );

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  async function acknowledge() {
    if (!data?.current) return;
    const ok = await ack.run(() =>
      apiFetch(`/house-rules/${data.current!.id}/acknowledge`, { method: 'POST', body: JSON.stringify({ tenancyId }) }),
    );
    if (ok) await load(tenancyId);
  }

  async function publishVersion() {
    if (!landlordId) return;
    const ok = await publish.run(() =>
      apiFetch(`/workspaces/${landlordId}/house-rules`, {
        method: 'POST',
        body: JSON.stringify({ body: draft, propertyId: propertyId || undefined }),
      }),
    );
    if (ok) {
      setDraft('');
      await load(tenancyId);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Current house rules"
        action={
          data?.current ? (
            <Pill>
              {data.acknowledged ? 'Acknowledged' : 'Not acknowledged'} · v{data.current.version}
            </Pill>
          ) : null
        }
      >
        {data?.current ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{data.current.body}</p>
            {!data.acknowledged ? (
              <>
                <Button variant="primary" size="sm" className="mt-4" disabled={ack.busy} onClick={() => void acknowledge()}>
                  {ack.busy ? 'Recording…' : 'Acknowledge'}
                </Button>
                <ErrorText>{ack.error}</ErrorText>
              </>
            ) : (
              <div className="mt-4">
                <Banner tone="green">This tenancy has acknowledged the current version.</Banner>
              </div>
            )}
          </>
        ) : (
          <Empty>No house rules published yet.</Empty>
        )}
      </Card>

      {canManage && landlordId && (
        <Card title="Publish a new version">
          {properties.length > 0 && (
            <Select
              label="Scope"
              value={propertyId}
              onChange={setPropertyId}
              options={[{ value: '', label: 'All properties (workspace-wide)' }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
            />
          )}
          <div className="mt-3">
            <Textarea label="Rules text" value={draft} onChange={setDraft} rows={5} placeholder="House rules…" />
          </div>
          <Button variant="outline" size="sm" className="mt-3" disabled={publish.busy || !draft} onClick={() => void publishVersion()}>
            {publish.busy ? 'Publishing…' : 'Publish version'}
          </Button>
          <ErrorText>{publish.error}</ErrorText>
        </Card>
      )}

      {versions.length > 0 && (
        <Card title="Version history">
          <DataTable
            columns={[
              { header: 'Version', render: (v: RulesVersion) => `v${v.version}` },
              { header: 'Scope', render: (v: RulesVersion) => (v.propertyId ? properties.find((p) => p.id === v.propertyId)?.name ?? 'Property' : 'Workspace-wide') },
              { header: 'Published', align: 'right', render: (v: RulesVersion) => formatDate(v.createdAt) },
            ]}
            rows={versions}
            keyOf={(v) => v.id}
          />
        </Card>
      )}
    </div>
  );
}
