import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from './api';
import { useAuth } from './auth';

export interface PropertyLite {
  id: string;
  name: string;
  address: string | null;
  type: string;
  portfolioId: string | null;
}

interface TenancyApiRow {
  id: string;
  status: string;
  propertyId: string;
  rentMinor: string;
  currency: string;
  startDate: string;
}

export interface TenancyOption {
  id: string;
  status: string;
  label: string;
  propertyName: string;
  rentMinor?: string;
  currency: string;
}

const MANAGE = ['OWNER', 'CO_OWNER', 'MANAGER', 'ADMIN'];
const OWN = ['OWNER', 'CO_OWNER', 'ADMIN'];

const ACTIVE_WS_KEY = 'rl_active_ws';

interface WorkspaceContextValue {
  landlordId: string | null;
  workspaceName: string | null;
  isTenantOnly: boolean;
  roles: string[];
  canManage: boolean;
  canOwn: boolean;
  isAdmin: boolean;
  tenancies: TenancyOption[];
  tenanciesLoading: boolean;
  properties: PropertyLite[];
  selectedTenancyId: string | null;
  selectedTenancy: TenancyOption | null;
  setSelectedTenancyId: (id: string) => void;
  reloadTenancies: () => Promise<void>;
  reloadProperties: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { workspaces, tenancies: tenantTenancies } = useAuth();

  const activeWorkspace = useMemo(() => {
    const stored = localStorage.getItem(ACTIVE_WS_KEY);
    return workspaces.find((w) => w.landlordId === stored) ?? workspaces[0] ?? null;
  }, [workspaces]);

  const landlordId = activeWorkspace?.landlordId ?? null;
  const roles = activeWorkspace?.roles ?? (tenantTenancies.length ? ['TENANT'] : []);
  const isTenantOnly = !activeWorkspace && tenantTenancies.length > 0;
  const canManage = roles.some((r) => MANAGE.includes(r));
  const canOwn = roles.some((r) => OWN.includes(r));
  const isAdmin = roles.includes('ADMIN');

  const [tenancies, setTenancies] = useState<TenancyOption[]>([]);
  const [tenanciesLoading, setTenanciesLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string | null>(null);

  const reloadProperties = useCallback(async () => {
    if (!landlordId) {
      setProperties([]);
      return;
    }
    const rows = await apiFetch<PropertyLite[]>(`/workspaces/${landlordId}/properties`).catch(() => []);
    setProperties(rows);
  }, [landlordId]);

  const reloadTenancies = useCallback(async () => {
    setTenanciesLoading(true);
    try {
      if (landlordId) {
        const [rows, props] = await Promise.all([
          apiFetch<TenancyApiRow[]>(`/workspaces/${landlordId}/tenancies`).catch(() => []),
          apiFetch<PropertyLite[]>(`/workspaces/${landlordId}/properties`).catch(() => []),
        ]);
        setProperties(props);
        const nameFor = (pid: string) => props.find((p) => p.id === pid)?.name ?? `Property ${pid.slice(0, 6)}`;
        const opts: TenancyOption[] = rows.map((t) => ({
          id: t.id,
          status: t.status,
          propertyName: nameFor(t.propertyId),
          label: nameFor(t.propertyId),
          rentMinor: t.rentMinor,
          currency: t.currency ?? 'INR',
        }));
        setTenancies(opts);
        setSelectedTenancyId((cur) => cur ?? opts[0]?.id ?? null);
      } else if (tenantTenancies.length) {
        const opts: TenancyOption[] = tenantTenancies.map((t) => ({
          id: t.tenancyId,
          status: t.status,
          propertyName: t.propertyName,
          label: t.propertyName,
          currency: 'INR',
        }));
        setTenancies(opts);
        setSelectedTenancyId((cur) => cur ?? opts[0]?.id ?? null);
      } else {
        setTenancies([]);
      }
    } finally {
      setTenanciesLoading(false);
    }
  }, [landlordId, tenantTenancies]);

  useEffect(() => {
    void reloadTenancies();
  }, [reloadTenancies]);

  const selectedTenancy = useMemo(
    () => tenancies.find((t) => t.id === selectedTenancyId) ?? null,
    [tenancies, selectedTenancyId],
  );

  const value: WorkspaceContextValue = {
    landlordId,
    workspaceName: activeWorkspace?.name ?? (isTenantOnly ? 'Tenant portal' : null),
    isTenantOnly,
    roles,
    canManage,
    canOwn,
    isAdmin,
    tenancies,
    tenanciesLoading,
    properties,
    selectedTenancyId,
    selectedTenancy,
    setSelectedTenancyId,
    reloadTenancies,
    reloadProperties,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
