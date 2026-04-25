'use client';
/**
 * NavTopActions — slim topbar right side.
 * Renders global search + role-based links only (no user avatar — that lives in sidebar bottom).
 */
import Link from '@/app/components/AppLink';
import { useEffect, useState } from 'react';
import { AUTH_STATE_EVENT, getAuthSnapshot, restoreAuthSession } from '@/features/auth/authStore';
import { useT } from '@/app/i18n/useI18n';
import { hasRoleAccess } from '@/features/auth/roles';
import NavGlobalSearch from './NavGlobalSearch';
import styles from '../layout.module.css';

function readRole(): string | null {
  return getAuthSnapshot()?.role ?? null;
}

export default function NavTopActions() {
  const t = useT();
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

  const isEditor  = hasRoleAccess(role, 'editor');
  const canSearch = hydrated && Boolean(role);

  return (
    <>
      {canSearch && <NavGlobalSearch />}
      {isEditor && (
        <Link href="/management/new-service" className={styles.topBarNewBtn}>
          {t('nav.new_service') || 'New service'}
        </Link>
      )}
    </>
  );
}
