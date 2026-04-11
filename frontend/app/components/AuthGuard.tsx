'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuthSnapshot, getToken } from '@/features/auth/authStore';
import { hasRoleAccess, requiredRoleForPath } from '@/features/auth/roles';
import {
  fetchInstallStatusSnapshot,
  isModuleUiVisible,
  invalidateInstallStatusCache,
  markInstallReady,
} from '@/features/install/installStatus';

// Install wizard route: always available without authentication.
const INSTALL_PATH = '/install';

function isC3ScopedPath(pathname: string) {
  return (
    pathname === '/c3-dashboard' ||
    pathname.startsWith('/c3/') ||
    pathname === '/admin/new-c3' ||
    pathname === '/management/new-c3' ||
    pathname === '/admin/c3' ||
    pathname.startsWith('/admin/c3/') ||
    pathname.startsWith('/admin/c3-')
  );
}

export { invalidateInstallStatusCache, markInstallReady };

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname() ?? '/';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The install page is always available.
    if (pathname.startsWith(INSTALL_PATH)) { setReady(true); return; }

    let cancelled = false;

    async function check() {
      // Check install status first; systems that are not READY go back to the wizard.
      let installStatus = null;
      try {
        installStatus = await fetchInstallStatusSnapshot();
      } catch {
        installStatus = null;
      }
      if (cancelled) return;

      if (!installStatus || installStatus.status !== 'READY') {
        router.replace(INSTALL_PATH);
        return;
      }

      if (isC3ScopedPath(pathname) && !isModuleUiVisible(installStatus, 'C3_TAXONOMY')) {
        router.replace('/');
        return;
      }

      // Standard auth check.
      if (pathname.startsWith('/login')) { setReady(true); return; }
      if (!getToken()) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const requiredRole = requiredRoleForPath(pathname);
      if (requiredRole && !hasRoleAccess(getAuthSnapshot()?.role, requiredRole)) {
        router.replace('/');
        return;
      }

      if (!cancelled) setReady(true);
    }

    check();
    return () => { cancelled = true; };
  }, [pathname, router]);

  if (!ready) return null;
  return <>{children}</>;
}
