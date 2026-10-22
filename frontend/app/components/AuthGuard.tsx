'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess, requiredRoleForPath, type AppRole } from '@/features/auth/roles';
import { useT } from '@/app/i18n/useI18n';
import {
  fetchInstallStatusSnapshot,
  isModuleUiVisible,
  invalidateInstallStatusCache,
  markInstallReady,
} from '@/features/install/installStatus';
import { MODULE_CODES, moduleForPath, type ModuleDefinition } from '@/features/modules/manifest';
import { PermissionGate } from './layout-v2';
import ModuleInactive from './ModuleInactive';

// Install wizard route: always available without authentication.
const INSTALL_PATH = '/install';

export { invalidateInstallStatusCache, markInstallReady };

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const t = useT();
  const router   = useRouter();
  const pathname = usePathname() ?? '/';
  const [ready, setReady] = useState(false);
  const [forbiddenRole, setForbiddenRole] = useState<AppRole | null>(null);
  const [inactiveModule, setInactiveModule] = useState<ModuleDefinition | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- U5: auth guard synchronizes local access state from install/auth checks and redirects. */
  useEffect(() => {
    // The install page is always available.
    if (pathname.startsWith(INSTALL_PATH)) {
      setForbiddenRole(null);
      setInactiveModule(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    setForbiddenRole(null);
    setInactiveModule(null);

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

      const routeModule = moduleForPath(pathname);
      if (
        !installFetchFailed &&
        routeModule &&
        routeModule.code !== MODULE_CODES.CORE &&
        !isModuleUiVisible(installStatus, routeModule.code)
      ) {
        // Explain instead of silently sending the user home.
        setInactiveModule(routeModule);
        setReady(true);
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
  if (inactiveModule) return <ModuleInactive module={inactiveModule} />;
  if (forbiddenRole) {
    return (
      <PermissionGate
        allowed={false}
        title={t('layout.permission_gate.title')}
        message={t('shell.auth_guard.forbidden_message', {
          role: t(`administration.users.role.${forbiddenRole}.label`),
        })}
      >
        {children}
      </PermissionGate>
    );
  }
  return <>{children}</>;
}
