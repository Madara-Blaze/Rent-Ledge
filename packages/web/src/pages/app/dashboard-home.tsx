import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner, Card, DataTable, PageHeader, Stat, StatusBadge } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import { useWorkspace, type TenancyOption } from '@/lib/workspace';

interface DepositsSummary {
  totalHeldMinor: string;
}
interface TdsSummary {
  totalTdsMinor: string;
}
interface IncomeStatement {
  period: string;
  totalIncomeMinor: string;
}

export function DashboardHome() {
  const { user } = useAuth();
  const { landlordId, isTenantOnly, tenancies, properties, canManage } = useWorkspace();
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [deposits, setDeposits] = useState<DepositsSummary | null>(null);
  const [tds, setTds] = useState<TdsSummary | null>(null);

  useEffect(() => {
    if (!landlordId) return;
    void (async () => {
      setIncome(await apiFetch<IncomeStatement>(`/workspaces/${landlordId}/reports/income-statement`).catch(() => null));
      setDeposits(await apiFetch<DepositsSummary>(`/workspaces/${landlordId}/reports/deposits-summary`).catch(() => null));
      setTds(await apiFetch<TdsSummary>(`/workspaces/${landlordId}/reports/tds-summary`).catch(() => null));
    })();
  }, [landlordId]);

  const active = tenancies.filter((t) => t.status === 'ACTIVE').length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`.trim()}
        description={
          isTenantOnly
            ? 'Your tenancies, payments, agreements and notices in one place.'
            : 'A live snapshot of your portfolio. All figures are computed from the ledger.'
        }
        actions={
          landlordId && canManage ? (
            <Link to="/app/tenancies">
              <Button variant="primary" size="sm">
                New tenancy
              </Button>
            </Link>
          ) : undefined
        }
      />

      {landlordId ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label={`Income (${income?.period ?? 'FY'})`} value={formatINR(income?.totalIncomeMinor)} accent />
            <Stat label="Deposits held" value={formatINR(deposits?.totalHeldMinor)} sub={`${tenancies.length} tenancies`} />
            <Stat label="TDS withheld" value={formatINR(tds?.totalTdsMinor)} />
            <Stat label="Properties" value={String(properties.length)} sub={`${active} active tenancies`} />
          </div>

          <Card
            title="Tenancies"
            action={
              <Link to="/app/tenancies" className="text-sm text-white/50 hover:text-white">
                Manage →
              </Link>
            }
          >
            <DataTable
              columns={[
                { header: 'Property', render: (t: TenancyOption) => t.propertyName },
                { header: 'Status', render: (t: TenancyOption) => <StatusBadge status={t.status} /> },
                { header: 'Rent', align: 'right', render: (t: TenancyOption) => formatINR(t.rentMinor) },
              ]}
              rows={tenancies}
              keyOf={(t) => t.id}
              empty="No tenancies yet — create one under Tenancies."
            />
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Banner tone="blue">
            You're signed in to the tenant portal. Use the sidebar to view your finances, agreements and notices, raise
            maintenance tickets, and exercise your privacy rights.
          </Banner>
          <Card title="Your tenancies">
            <DataTable
              columns={[
                { header: 'Property', render: (t: TenancyOption) => t.propertyName },
                { header: 'Status', render: (t: TenancyOption) => <StatusBadge status={t.status} /> },
                {
                  header: '',
                  align: 'right',
                  render: () => (
                    <Link to="/app/t/overview" className="text-sm text-white/50 hover:text-white">
                      Open →
                    </Link>
                  ),
                },
              ]}
              rows={tenancies}
              keyOf={(t) => t.id}
              empty="No tenancies linked to your account yet."
            />
          </Card>
        </div>
      )}
    </div>
  );
}
