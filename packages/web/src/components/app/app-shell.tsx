import {
  BarChart3,
  BellRing,
  BookText,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileText,
  Gavel,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BrandMark } from '@/components/brand-mark';
import { VideoBackground } from './video-background';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const WORKSPACE_NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/properties', label: 'Properties', icon: Building2 },
  { to: '/app/tenancies', label: 'Tenancies', icon: Users },
  { to: '/app/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/app/evidence', label: 'Evidence vault', icon: ShieldCheck },
  { to: '/app/disputes', label: 'Disputes', icon: Gavel },
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
  { to: '/app/reminders', label: 'Rent reminders', icon: BellRing },
  { to: '/app/team', label: 'Team & access', icon: UserCog },
  { to: '/app/audit', label: 'Audit log', icon: ScrollText },
];

const TENANCY_NAV: NavItem[] = [
  { to: '/app/t/overview', label: 'Overview', icon: Wallet },
  { to: '/app/t/billing', label: 'Rent & billing', icon: Receipt },
  { to: '/app/t/payments', label: 'Payments', icon: CreditCard },
  { to: '/app/t/deposit', label: 'Deposit', icon: PiggyBank },
  { to: '/app/t/agreements', label: 'Agreements', icon: FileSignature },
  { to: '/app/t/documents', label: 'Documents', icon: FileText },
  { to: '/app/t/notices', label: 'Notices', icon: Mail },
  { to: '/app/t/house-rules', label: 'House rules', icon: BookText },
  { to: '/app/t/inspections', label: 'Inspections', icon: ClipboardCheck },
  { to: '/app/t/tds', label: 'TDS', icon: Percent },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: '/app/account', label: 'KYC & account', icon: Users },
  { to: '/app/privacy', label: 'Privacy (DPDP)', icon: Lock },
];

function NavGroup({ title, items, onNavigate }: { title: string; items: NavItem[]; onNavigate: () => void }) {
  return (
    <div className="mb-5">
      {title && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">{title}</p>}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#FF0000]/10 text-white'
                    : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`size-4 shrink-0 ${isActive ? 'text-[#FF0000]' : ''}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TenancyPicker() {
  const { tenancies, selectedTenancyId, setSelectedTenancyId } = useWorkspace();
  if (tenancies.length === 0) {
    return <p className="px-3 pb-3 text-xs text-white/30">No tenancies yet.</p>;
  }
  return (
    <div className="px-3 pb-3">
      <select
        aria-label="Active tenancy"
        value={selectedTenancyId ?? ''}
        onChange={(e) => setSelectedTenancyId(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#FF0000]/60"
      >
        {tenancies.map((t) => (
          <option key={t.id} value={t.id} className="bg-black">
            {t.label} · {titleCase(t.status)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { workspaceName, landlordId, isTenantOnly, isAdmin, roles } = useWorkspace();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const close = () => setOpen(false);

  const sidebar: ReactNode = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BrandMark size={20} className="text-[#FF0000]" />
        <span className="text-[15px] font-semibold">RentLedger</span>
        <button
          className="ml-auto text-white/40 hover:text-white lg:hidden"
          onClick={close}
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-6">
        {landlordId && <NavGroup title="Workspace" items={WORKSPACE_NAV} onNavigate={close} />}
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Tenancy</div>
        <TenancyPicker />
        <NavGroup title="" items={TENANCY_NAV} onNavigate={close} />
        <NavGroup title="Account" items={ACCOUNT_NAV} onNavigate={close} />
        {isAdmin && (
          <NavGroup
            title="Admin"
            items={[{ to: '/app/admin/policies', label: 'Jurisdiction policies', icon: Scale }]}
            onNavigate={close}
          />
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-3 text-xs text-white/35">
        {roles.length > 0 && <p className="truncate">{roles.map(titleCase).join(' · ')}</p>}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen text-white">
      <VideoBackground />

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-white/10 bg-black/50 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-black/85 backdrop-blur-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="text-white/60 hover:text-white lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
              <span className="text-sm text-white/50">
                {workspaceName ?? (isTenantOnly ? 'Tenant portal' : 'RentLedger')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-white/50 sm:inline">{user?.name}</span>
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-57px)] flex-col">
          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
            >
              <Outlet />
            </motion.main>
          </AnimatePresence>

          <footer className="border-t border-white/10 bg-black/30 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-5 text-xs text-white/40 sm:flex-row sm:items-center sm:px-6">
              <span>© 2026 RentLedger · Not legal or tax advice.</span>
              <div className="flex flex-wrap items-center gap-4">
                <Link to="/terms" className="transition-colors hover:text-white">
                  Terms of Service
                </Link>
                <Link to="/privacy" className="transition-colors hover:text-white">
                  Privacy Policy
                </Link>
                <Link to="/app/privacy" className="transition-colors hover:text-white">
                  Your data (DPDP)
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
