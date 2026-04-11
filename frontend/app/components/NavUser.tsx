'use client';
/**
 * NavUser — shows logged-in user avatar + name in the top nav.
 * Click opens a dropdown with "User Info" and "Log Out".
 * Restores a minimal session snapshot from secure cookies and cached session storage.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import { AUTH_STATE_EVENT, clearAuthSession, getAuthSnapshot, restoreAuthSession } from '@/features/auth/authStore';
import styles from './NavUser.module.css';

// ── Avatar colour derived from username (deterministic) ──────────────────────
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
function pickColor(name: string): string {
  let h = 0;
  for (const c of name) h = ((h * 31) + c.charCodeAt(0)) & 0x7fffffff;
  return PALETTE[h % PALETTE.length];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NavUser() {
  const t = useT();
  const router   = useRouter();
  const wrapRef  = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [open,        setOpen]        = useState(false);

  useEffect(() => {
    let cancelled = false;
    const syncUser = async () => {
      const snapshot = await restoreAuthSession();
      if (cancelled) return;
      setDisplayName(snapshot?.display_name || snapshot?.username || null);
      setHydrated(true);
    };

    void syncUser();
    window.addEventListener('focus', syncUser);
    window.addEventListener(AUTH_STATE_EVENT, syncUser);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', syncUser);
      window.removeEventListener(AUTH_STATE_EVENT, syncUser);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearAuthSession();
    }
    router.replace('/login');
  }

  // Not yet hydrated or not logged in → render nothing (AuthGuard handles redirect)
  if (!hydrated || !displayName) return null;

  const initial = displayName[0].toUpperCase();
  const color   = pickColor(displayName);

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        type="button"
      >
        <span className={styles.avatar} style={{ background: color }} aria-hidden="true">
          {initial}
        </span>
        <span className={styles.name}>{displayName}</span>
        <span className={styles.caret} aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <Link
            href="/user-info"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            {t('nav.user_info')}
          </Link>
          <hr className={styles.menuDivider} />
          <button
            className={styles.menuItemDanger}
            role="menuitem"
            type="button"
            onClick={handleLogout}
          >
            {t('nav.log_out')}
          </button>
        </div>
      )}
    </div>
  );
}
