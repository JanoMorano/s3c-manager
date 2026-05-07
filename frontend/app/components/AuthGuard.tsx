'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess, requiredRoleForPath, ROLE_LABELS, type AppRole } from '@/features/auth/roles';
import {
  fetchInstallStatusSnapshot,
  isModuleUiVisible,
  invalidateInstallStatusCache,
  markInstallReady,
} from '@/features/install/installStatus';
import { PermissionGate } from './layout-v2';

// Install wizard route: always available without authentication.
const INSTALL_PATH = '/install';

function isC3ScopedPath(pathname: string) {
  return (
    pathname === '/c3-dashboard' ||
    pathname.startsWith('/c3/') ||
    pathname === '/admin/new-c3' ||
    pathname === '/administration/c3-ref' ||
    pathname === '/administration/c3-capability-builder' ||
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
  const [forbiddenRole, setForbiddenRole] = useState<AppRole | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- U5: auth guard synchronizes local access state from install/auth checks and redirects. */
  useEffect(() => {
    // The install page is always available.
    if (pathname.startsWith(INSTALL_PATH)) {
      setForbiddenRole(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    setForbiddenRole(null);

    async function check() {
      // Check install status first; systems that are not READY go back to the wizard.
      // Distinguish between a network/fetch error and an explicit non-READY response:
      // only redirect to /install for explicit non-READY status, not on transient fetch failures.
      let installStatus = null;
      let installFetchFailed = false;
      try {
        installStatus = await fetchInstallStatusSnapshot();
      } catch {
        installFetchFailed = true;
      }
      if (cancelled) return;

      if (!installFetchFailed && (!installStatus || installStatus.status !== 'READY')) {
        router.replace(INSTALL_PATH);
        return;
      }

      if (!installFetchFailed && isC3ScopedPath(pathname) && !isModuleUiVisible(installStatus, 'C3_TAXONOMY')) {
        router.replace('/');
        return;
      }

      // Standard auth check.
      if (pathname.startsWith('/login')) { setReady(true); return; }
      const session = await restoreAuthSession();
      if (cancelled) return;
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (session.must_change_password && !pathname.startsWith('/user-info')) {
        router.replace(`/user-info?must_change_password=1&next=${encodeURIComponent(pathname)}`);
        return;
      }

      const requiredRole = requiredRoleForPath(pathname);
      if (requiredRole && !hasRoleAccess(session.role, requiredRole)) {
        setForbiddenRole(requiredRole);
        setReady(true);
        return;
      }

      if (!cancelled) setReady(true);
    }

    check();
    return () => { cancelled = true; };
  }, [pathname, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!ready) return null;
  if (forbiddenRole) {
    return (
      <PermissionGate
        allowed={false}
        title="Nemáte oprávnění"
        message={`Tato stránka vyžaduje roli ${ROLE_LABELS[forbiddenRole]}. Pokud ji potřebujete spravovat, požádejte administrátora o přiřazení role.`}
      >
        {children}
      </PermissionGate>
    );
  }
  return <>{children}</>;
}
