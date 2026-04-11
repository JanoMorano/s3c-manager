/** Token storage — localStorage. Isomorphic (SSR-safe). */
const ACCESS_KEY  = 'sc_access_token';
const REFRESH_KEY = 'sc_refresh_token';
const SNAPSHOT_KEY = 'sc_auth_snapshot';
export const AUTH_STATE_EVENT = 'sc-auth-state-changed';
const isBrowser   = typeof window !== 'undefined';

export const getToken        = (): string | null => isBrowser ? localStorage.getItem(ACCESS_KEY)  : null;
export const getRefreshToken = (): string | null => isBrowser ? localStorage.getItem(REFRESH_KEY) : null;

export interface AuthSnapshot {
  username: string | null;
  display_name: string | null;
  role: string | null;
}

function decodeToken(token: string): AuthSnapshot {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part)) as { username?: string; display_name?: string | null; role?: string };
    return {
      username: payload.username ?? null,
      display_name: payload.display_name ?? null,
      role: payload.role ?? null,
    };
  } catch {
    return { username: null, display_name: null, role: null };
  }
}

export const getAuthSnapshot = (): AuthSnapshot | null => {
  if (!isBrowser) return null;

  const cached = sessionStorage.getItem(SNAPSHOT_KEY) || localStorage.getItem(SNAPSHOT_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as AuthSnapshot;
    } catch {
      sessionStorage.removeItem(SNAPSHOT_KEY);
      localStorage.removeItem(SNAPSHOT_KEY);
    }
  }

  const token = getToken();
  if (!token) return null;

  const snapshot = decodeToken(token);
  sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
};

export const setTokens = (access: string, refresh: string): void => {
  localStorage.setItem(ACCESS_KEY,  access);
  localStorage.setItem(REFRESH_KEY, refresh);
  const snapshot = decodeToken(access);
  sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  if (isBrowser) window.dispatchEvent(new Event(AUTH_STATE_EVENT));
};

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(SNAPSHOT_KEY);
  localStorage.removeItem(SNAPSHOT_KEY);
  if (isBrowser) window.dispatchEvent(new Event(AUTH_STATE_EVENT));
};
