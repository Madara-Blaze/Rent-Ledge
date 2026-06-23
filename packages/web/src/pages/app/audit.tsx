import { useEffect, useState } from 'react';
import { Banner, Card, DataTable, PageHeader, Pill } from '@/components/dashboard/primitives';
import { apiFetch } from '@/lib/api';
import { formatDateTime, shortId, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface AuditRow {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ip: string | null;
  createdAt: string;
}

export function AuditPage() {
  const { landlordId } = useWorkspace();
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!landlordId) return;
    void (async () => {
      setRows(await apiFetch<AuditRow[]>(`/workspaces/${landlordId}/audit?limit=150`).catch(() => []));
    })();
  }, [landlordId]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Audit log" />
        <Banner tone="blue">The audit log is scoped to the landlord workspace.</Banner>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="An append-only record of who did what, and when — the platform's source of truth for activity."
      />
      <Card>
        <DataTable
          columns={[
            { header: 'When', render: (r) => formatDateTime(r.createdAt) },
            { header: 'Action', render: (r) => <Pill>{titleCase(r.action)}</Pill> },
            {
              header: 'Resource',
              render: (r) => (
                <span className="text-white/60">
                  {r.resourceType ? titleCase(r.resourceType) : '—'}
                  {r.resourceId ? ` · ${shortId(r.resourceId)}` : ''}
                </span>
              ),
            },
            { header: 'Actor', render: (r) => <span className="font-mono text-xs text-white/40">{shortId(r.actorUserId)}</span> },
          ]}
          rows={rows}
          keyOf={(r) => r.id}
          empty="No audit entries yet."
        />
      </Card>
    </div>
  );
}
