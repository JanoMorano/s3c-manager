'use client';
/**
 * NavRight — right side of the top nav bar.
 * Renders conditional admin links based on the user's JWT role, then NavUser at far right.
 *
 * Role matrix:
 *   admin  → Search + Administration + Content Admin + NavUser
 *   editor → Search + Content Admin + NavUser
 *   viewer → Search + NavUser
 *
 * Flash fix (6F): role is cached in sessionStorage so it is available on re-navigations
 * and page reloads without waiting for useEffect to fire.
 */
import Link from '@/app/components/AppLink';
import { useEffect, useState } from 'react';
import { AUTH_STATE_EVENT, getAuthSnapshot, getToken } from '@/features/auth/authStore';
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
    const syncRole = () => {
      setRole(readRole());
      setHydrated(true);
    };
    syncRole();

    window.addEventListener('focus', syncRole);
    window.addEventListener('storage', syncRole);
    window.addEventListener(AUTH_STATE_EVENT, syncRole);

    if (!getToken()) setRole(null);

    return () => {
      window.removeEventListener('focus', syncRole);
      window.removeEventListener('storage', syncRole);
      window.removeEventListener(AUTH_STATE_EVENT, syncRole);
    };
  }, []);

  const isEditor = hasRoleAccess(role, 'editor');
  const isAdmin  = hasRoleAccess(role, 'admin');
  const canSearch = hydrated && (Boolean(role) || Boolean(getToken()));

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
