/**
 * Tiny typed API client for the RentLedger backend. Stores the JWT pair in
 * localStorage, attaches the bearer token, and transparently refreshes once on 401.
 */
import { DEMO, demoFetch } from './demo';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1';

const ACCESS_KEY = 'rl_access';
const REFRESH_KEY = 'rl_refresh';

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return accessToken;
}
export function getRefreshToken(): string | null {
  return refreshToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  if (DEMO) {
    const method = (options.method ?? 'GET').toUpperCase();
    const body = options.body ? (JSON.parse(options.body as string) as Record<string, unknown>) : undefined;
    try {
      return (await demoFetch(path, method, body)) as T;
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      throw new ApiError((e as Error).message, status);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return apiFetch<T>(path, options, false);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ApiError(body?.error?.message ?? res.statusText, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Fetch a JSON resource and trigger a browser download of it as a .json file. */
export async function downloadJson(path: string, filename: string): Promise<void> {
  const data = await apiFetch<unknown>(path);
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

/** Fetch a file (e.g. CSV) with auth and trigger a browser download. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  if (DEMO) {
    const text = String(await demoFetch(path, 'GET'));
    triggerDownload(new Blob([text], { type: 'text/csv' }), filename);
    return;
  }
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 401 && (await tryRefresh())) {
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    res = await fetch(`${BASE}${path}`, { headers });
  }
  if (!res.ok) throw new ApiError('Download failed', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
