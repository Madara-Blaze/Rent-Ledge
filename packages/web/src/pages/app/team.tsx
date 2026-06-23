import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  ErrorText,
  Field,
  PageHeader,
  Select,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { shortId, titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface RoleAssignment {
  id: string;
  userId: string;
  userName: string;
  role: string;
  scopeType: string;
  scopeId: string | null;
}

const ROLES = ['OWNER', 'CO_OWNER', 'MANAGER', 'ACCOUNTANT', 'TENANT', 'ADMIN'];
const SCOPES = ['LANDLORD', 'PORTFOLIO', 'PROPERTY', 'TENANCY'];

export function TeamPage() {
  const { landlordId, canOwn } = useWorkspace();
  const [rows, setRows] = useState<RoleAssignment[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('MANAGER');
  const [scopeType, setScopeType] = useState('LANDLORD');
  const [scopeId, setScopeId] = useState('');
  const grant = useRun();
  const revoke = useRun();

  const load = useCallback(async () => {
    if (!landlordId) return;
    setRows(await apiFetch<RoleAssignment[]>(`/workspaces/${landlordId}/roles`).catch(() => []));
  }, [landlordId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!landlordId) {
    return (
      <div>
        <PageHeader title="Team & access" />
        <Banner tone="blue">Access control is managed by the landlord workspace.</Banner>
      </div>
    );
  }

  async function doGrant() {
    const ok = await grant.run(async () => {
      await apiFetch(`/workspaces/${landlordId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ userId, role, scopeType, scopeId: scopeId || undefined }),
      });
    });
    if (ok) {
      setUserId('');
      setScopeId('');
      await load();
    }
  }

  async function doRevoke(id: string) {
    await revoke.run(async () => {
      await apiFetch(`/workspaces/${landlordId}/roles/${id}`, { method: 'DELETE' });
    });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Team & access"
        description="Resource-scoped roles and delegation. Owners and co-owners can grant or revoke access."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Role assignments">
            <DataTable
              columns={[
                { header: 'User', render: (r) => <span className="text-white">{r.userName}</span> },
                { header: 'Role', render: (r) => <Badge tone="blue">{titleCase(r.role)}</Badge> },
                {
                  header: 'Scope',
                  render: (r) => (
                    <span className="text-white/60">
                      {titleCase(r.scopeType)}
                      {r.scopeId ? ` · ${shortId(r.scopeId)}` : ''}
                    </span>
                  ),
                },
                {
                  header: '',
                  align: 'right',
                  render: (r) =>
                    canOwn ? (
                      <Button variant="ghost" size="sm" disabled={revoke.busy} onClick={() => void doRevoke(r.id)}>
                        Revoke
                      </Button>
                    ) : null,
                },
              ]}
              rows={rows}
              keyOf={(r) => r.id}
              empty="No delegated roles yet."
            />
          </Card>
        </div>

        {canOwn && (
          <Card title="Delegate a role">
            <div className="space-y-3">
              <Field label="User ID" value={userId} onChange={setUserId} placeholder="UUID of the user" hint="The person must already have an account." />
              <Select label="Role" value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: titleCase(r) }))} />
              <Select label="Scope" value={scopeType} onChange={setScopeType} options={SCOPES.map((s) => ({ value: s, label: titleCase(s) }))} />
              {scopeType !== 'LANDLORD' && (
                <Field label="Scope ID" value={scopeId} onChange={setScopeId} placeholder="Resource UUID for this scope" />
              )}
              <Button variant="primary" size="sm" className="w-full" disabled={grant.busy || !userId} onClick={() => void doGrant()}>
                {grant.busy ? 'Granting…' : 'Grant access'}
              </Button>
              <ErrorText>{grant.error}</ErrorText>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
