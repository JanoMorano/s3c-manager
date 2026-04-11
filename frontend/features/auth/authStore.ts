/** Client auth snapshot storage. No JWTs are persisted in browser storage. */
const SNAPSHOT_KEY = 'sc_auth_snapshot';
const isBrowser = typeof window !== 'undefined';

export const AUTH_STATE_EVENT = 'sc-auth-state-changed';

export interface AuthSnapshot {
  id: number | null;
  username: string | null;
  display_name: string | null;
  role: string | null;
  auth_provider: string | null;
}

type AuthUserShape = Partial<AuthSnapshot> & Record<string, unknown>;

let memorySnapshot: AuthSnapshot | null = null;
let restorePromise: Promise<AuthSnapshot | null> | null = null;

function readStoredSnapshot(): AuthSnapshot | null {
  if (!isBrowser) return null;

  const cached = sessionStorage.getItem(SNAPSHOT_KEY);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as AuthSnapshot;
  } catch {
    sessionStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }
}

function persistSnapshot(snapshot: AuthSnapshot | null): void {
  memorySnapshot = snapshot;
  if (!isBrowser) return;

  if (snapshot) {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } else {
    sessionStorage.removeItem(SNAPSHOT_KEY);
  }
  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}

function snapshotFromUser(user: AuthUserShape): AuthSnapshot {
  return {
    id: typeof user.id === 'number' ? user.id : (user.id != null ? Number(user.id) : null),
    username: typeof user.username === 'string' ? user.username : null,
    display_name: typeof user.display_name === 'string' ? user.display_name : null,
    role: typeof user.role === 'string' ? user.role : null,
    auth_provider: typeof user.auth_provider === 'string' ? user.auth_provider : null,
  };
}

async function fetchCurrentUser(): Promise<AuthSnapshot | null> {
  if (!isBrowser) return null;

  const res = await fetch('/api/v1/auth/me', {
    cache: 'no-store',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) return null;

  const user = await res.json() as AuthUserShape;
  const snapshot = snapshotFromUser(user);
  persistSnapshot(snapshot);
  return snapshot;
}

export function getAuthSnapshot(): AuthSnapshot | null {
  return memorySnapshot ?? readStoredSnapshot();
}

export function setAuthSnapshot(snapshot: AuthSnapshot | null): void {
  persistSnapshot(snapshot);
}

export function setAuthSnapshotFromUser(user: AuthUserShape | null | undefined): void {
  if (!user) {
    persistSnapshot(null);
    return;
  }
  persistSnapshot(snapshotFromUser(user));
}

export function clearAuthSession(): void {
  persistSnapshot(null);
}

export async function restoreAuthSession(force = false): Promise<AuthSnapshot | null> {
  if (!isBrowser) return null;
  if (restorePromise && !force) return restorePromise;

  const task = (async () => {
    const restored = await fetchCurrentUser();
    if (restored) return restored;

    const refreshed = await refreshAuthSession();
    if (refreshed) {
      const refreshedSnapshot = await fetchCurrentUser();
      if (refreshedSnapshot) return refreshedSnapshot;
    }

    clearAuthSession();
    return null;
  })();

  restorePromise = task;
  try {
    return await task;
  } finally {
    restorePromise = null;
  }
}

export async function refreshAuthSession(): Promise<boolean> {
  if (!isBrowser) return false;

  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    clearAuthSession();
    return false;
  }

  return true;
}

// Backward-compatible no-op shims. JWTs are no longer persisted in browser storage.
export const getToken = (): string | null => null;
export const getRefreshToken = (): string | null => null;
export const setTokens = (): void => {};
export const clearTokens = (): void => clearAuthSession();
