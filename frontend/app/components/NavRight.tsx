'use client';
/**
 * NavRight — right side of the top nav bar.
 * Renders conditional admin links based on the active session role, then NavUser at far right.
 *
 * Role matrix:
 *   admin  → Search + Administration + Content Admin + NavUser
 *   editor → Search + Content Admin + NavUser
 *   viewer → Search + NavUser
 *
 * Session is restored from secure cookies and cached in sessionStorage as a minimal snapshot.
 */
import Link from '@/app/components/AppLink';
import { useEffect, useState } from 'react';
import { AUTH_STATE_EVENT, getAuthSnapshot, restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import NavUser from './NavUser';
import NavGlobalSearch from './NavGlobalSearch';
import styles from '../layout.module.css';

function readRole(): string | null {
  return getAuthSnapshot()?.role ?? null;
}

export default function NavRight() {
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const syncRole = async () => {
      const snapshot = await restoreAuthSession();
      if (cancelled) return;
      setRole(snapshot?.role ?? readRole());
      setHydrated(true);
    };
    void syncRole();

    window.addEventListener('focus', syncRole);
    window.addEventListener(AUTH_STATE_EVENT, syncRole);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', syncRole);
      window.removeEventListener(AUTH_STATE_EVENT, syncRole);
    };
  }, []);

  const isEditor = hasRoleAccess(role, 'editor');
  const isAdmin  = hasRoleAccess(role, 'admin');
  const canSearch = hydrated && Boolean(role);

  return (
    <>
      {canSearch && <NavGlobalSearch />}
      {isAdmin && (
        <Link href="/administration" className={styles.navLink}>Administration</Link>
      )}
      {isEditor && (
        <Link href="/management" className={styles.navLink}>Content Admin</Link>
      )}
      <NavUser />
    </>
  );
}
