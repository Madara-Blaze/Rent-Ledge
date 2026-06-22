import { LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { AgreementsTab } from '@/components/dashboard/agreements-tab';
import { EvidenceTab } from '@/components/dashboard/evidence-tab';
import { HouseRulesTab } from '@/components/dashboard/house-rules-tab';
import { MaintenanceTab } from '@/components/dashboard/maintenance-tab';
import { NoticesTab } from '@/components/dashboard/notices-tab';
import { OverviewTab } from '@/components/dashboard/overview-tab';
import { ReportsTab } from '@/components/dashboard/reports-tab';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { titleCase } from '@/lib/format';

interface TenancyRow {
  id: string;
  status: string;
}
type Tab = 'overview' | 'agreements' | 'maintenance' | 'notices' | 'houserules' | 'evidence' | 'reports';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'agreements', label: 'Agreements' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'notices', label: 'Notices' },
  { key: 'houserules', label: 'House rules' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'reports', label: 'Reports' },
];

export function Dashboard() {
  const { user, workspaces, tenancies: tenantTenancies, logout } = useAuth();
  const ws = workspaces[0] ?? null;
  const landlordId = ws?.landlordId ?? null;

  const [tenancies, setTenancies] = useState<TenancyRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    (async () => {
      if (ws) {
        const list = await apiFetch<TenancyRow[]>(`/workspaces/${ws.landlordId}/tenancies`).catch(() => []);
        setTenancies(list);
        setSelected((s) => s ?? list[0]?.id ?? null);
      } else if (tenantTenancies[0]) {
        setSelected((s) => s ?? tenantTenancies[0].tenancyId);
      }
    })();
  }, [ws, tenantTenancies]);

  const options = useMemo(
    () =>
      ws
        ? tenancies.map((t) => ({ id: t.id, label: `Tenancy ${t.id.slice(0, 8)}`, status: t.status }))
        : tenantTenancies.map((t) => ({ id: t.tenancyId, label: t.propertyName, status: t.status })),
    [ws, tenancies, tenantTenancies],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={20} className="text-[#FF0000]" />
            <span className="text-[15px] font-semibold">RentLedger</span>
            <span className="ml-3 hidden text-sm text-white/40 sm:inline">{ws ? ws.name : 'Tenant portal'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-white/50 sm:inline">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* tenancy selector */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select tenancy">
          {options.length === 0 && <p className="text-sm text-white/40">No tenancies yet.</p>}
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelected(o.id)}
              aria-pressed={selected === o.id}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                selected === o.id ? 'border-[#FF0000] bg-[#FF0000]/10 text-white' : 'border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {o.label} · {titleCase(o.status)}
            </button>
          ))}
        </div>

        {/* tab nav */}
        <nav className="mt-6 flex flex-wrap gap-1 border-b border-white/10" role="tablist" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                tab === t.key ? 'border-[#FF0000] text-white' : 'border-transparent text-white/50 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-8" role="tabpanel">
          {tab === 'overview' && <OverviewTab tenancyId={selected} />}
          {tab === 'agreements' && <AgreementsTab tenancyId={selected} />}
          {tab === 'maintenance' && <MaintenanceTab landlordId={landlordId} tenancyId={selected} />}
          {tab === 'notices' && <NoticesTab tenancyId={selected} />}
          {tab === 'houserules' && <HouseRulesTab landlordId={landlordId} tenancyId={selected} />}
          {tab === 'evidence' && <EvidenceTab landlordId={landlordId} tenancyId={selected} />}
          {tab === 'reports' && <ReportsTab landlordId={landlordId} />}
        </div>
      </main>
    </div>
  );
}
