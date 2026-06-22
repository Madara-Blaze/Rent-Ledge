import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, clearTokens, getAccessToken, getRefreshToken, setTokens } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  panValid: boolean;
  panLast4?: string | null;
}

export interface Workspace {
  landlordId: string;
  name: string;
  roles: string[];
}

export interface TenancyRef {
  tenancyId: string;
  status: string;
  propertyName: string;
}

interface MeResponse {
  user: AuthUser;
  workspaces: Workspace[];
  tenancies: TenancyRef[];
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignupInput {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  workspaceName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  workspaces: Workspace[];
  tenancies: TenancyRef[];
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tenancies, setTenancies] = useState<TenancyRef[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const me = await apiFetch<MeResponse>('/auth/me');
      setUser(me.user);
      setWorkspaces(me.workspaces);
      setTenancies(me.tenancies);
    } catch {
      clearTokens();
      setUser(null);
      setWorkspaces([]);
      setTenancies([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (getAccessToken()) await refreshMe();
      setLoading(false);
    })();
  }, [refreshMe]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await apiFetch<AuthTokens>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setTokens(res.accessToken, res.refreshToken);
      await refreshMe();
    },
    [refreshMe],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const res = await apiFetch<AuthTokens>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setTokens(res.accessToken, res.refreshToken);
      await refreshMe();
    },
    [refreshMe],
  );

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    if (rt) {
      await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: rt }) }).catch(
        () => undefined,
      );
    }
    clearTokens();
    setUser(null);
    setWorkspaces([]);
    setTenancies([]);
  }, []);

  return (
    <AuthContext.Provider value={{ user, workspaces, tenancies, loading, login, signup, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
