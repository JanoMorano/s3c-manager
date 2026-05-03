'use client';

import Link from '@/app/components/AppLink';
import { Bell, CheckCheck, Moon, Plus, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { AUTH_STATE_EVENT, restoreAuthSession, type AuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useTheme, type ThemeMode } from '@/features/theme/ThemeContext';
import { apiFetch } from '@/features/services/api/services.api';
import type { NotificationItem, NotificationsResponse } from '@/features/services/model/service.types';
import NavGlobalSearch from './NavGlobalSearch';
import ViewModeSwitch from './ViewModeSwitch';
import styles from '../layout.module.css';

interface Crumb {
  label: string;
  href?: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Administrace',
  administration: 'Administrace',
  capabilities: 'Schopnosti',
  catalogue: 'Katalog',
  coverage: 'Coverage',
  decisions: 'Decision log',
  'dependency-flow': 'Dependency flow',
  gaps: 'Gaps',
  graph: 'Graph',
  groups: 'Skupiny',
  impact: 'Impact analysis',
  import: 'Import',
  installation: 'Instalace',
  list: 'Service list',
  logs: 'Logy',
  management: 'Content admin',
  operations: 'Governance',
  overlaps: 'Overlaps',
  'owner-load': 'Owner load',
  portfolio: 'Portfolio',
  readiness: 'Readiness gate',
  reviews: 'Reviews',
  search: 'Search',
  services: 'Služby',
  spirals: 'Spirals',
  upload: 'Upload',
  users: 'Uživatelé',
  web: 'Web / SSO',
};

function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'dark' ? 'light' : 'dark';
}

function titleFromSegment(segment: string) {
  return SEGMENT_LABELS[segment] ?? decodeURIComponent(segment).replaceAll('-', ' ');
}

function buildBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/') return [{ label: 'S3C Manager', href: '/' }, { label: 'Přehled řízení' }];

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'S3C Manager', href: '/' }];
  let href = '';

  segments.slice(0, 3).forEach((segment, index) => {
    href += `/${segment}`;
    const isLast = index === Math.min(segments.length, 3) - 1;
    crumbs.push({
      label: titleFromSegment(segment),
      href: isLast ? undefined : href,
    });
  });

  return crumbs;
}

function shouldShowViewSwitch(pathname: string) {
  return !(
    pathname.startsWith('/admin') ||
    pathname.startsWith('/administration') ||
    pathname.startsWith('/import') ||
    pathname.startsWith('/install') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/management') ||
    pathname.startsWith('/user-info') ||
    pathname.endsWith('/edit') ||
    pathname.includes('/edit/')
  );
}

function serviceIdFromPath(pathname: string) {
  const match = pathname.match(/^\/services\/([^/]+)$/);
  return match?.[1] ?? null;
}

function primaryActionFor(pathname: string, isEditor: boolean): { href: string; label: string } | null {
  const serviceId = serviceIdFromPath(pathname);
  if (serviceId) return { href: `/services/${serviceId}/request`, label: 'Request access' };
  if (pathname.startsWith('/operations/readiness')) return { href: `${pathname}?filter=blocked`, label: 'Review blockers' };
  if (pathname.startsWith('/operations')) return { href: '/operations/decisions', label: 'Record decision' };
  if (pathname.startsWith('/services/list')) return { href: isEditor ? '/management/new-service' : '/services/list?requestable=true', label: isEditor ? 'New service' : 'Request service' };
  if (pathname.startsWith('/catalogue')) return { href: '/services/list?requestable=true', label: 'Request a service' };
  if (pathname.startsWith('/capabilities')) return { href: '/capabilities/coverage', label: 'Open coverage' };
  if (pathname.startsWith('/c3')) return { href: '/admin/new-c3', label: 'New C3 item' };
  if (pathname.startsWith('/import')) return { href: '/import/upload', label: 'Upload data' };
  if (isEditor) return { href: '/management/new-service', label: 'New service' };
  return { href: '/catalogue', label: 'Browse catalogue' };
}

function initials(snapshot: AuthSnapshot | null) {
  const name = snapshot?.display_name || snapshot?.username || 'S3C';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function TopBar() {
  const pathname = usePathname() ?? '/';
  const { mode, setMode } = useTheme();
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { data: notifications, mutate: refreshNotifications } = useSWR<NotificationsResponse>(
    '/api/v1/notifications?limit=8',
    apiFetch,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    let cancelled = false;
    const syncUser = async () => {
      const restored = await restoreAuthSession();
      if (!cancelled) setSnapshot(restored);
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

  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const isEditor = hasRoleAccess(snapshot?.role ?? null, 'editor');
  const primaryAction = primaryActionFor(pathname, isEditor);
  const unreadNotifications = notifications?.unread_count ?? 0;

  async function markAllNotificationsRead() {
    try {
      await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      await refreshNotifications();
    } catch {
      // Keep the panel usable even when the notification tables are not migrated yet.
    }
  }

  async function markNotificationRead(item: NotificationItem) {
    if (item.read_at) return;
    try {
      await fetch(`/api/v1/notifications/${item.id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      await refreshNotifications();
    } catch {
      // Silent fallback; navigation should not be blocked by read-state persistence.
    }
  }

  return (
    <div className={styles.topBar} role="banner">
      <nav className={styles.topBarBreadcrumbs} aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className={styles.breadcrumbItem}>
            {index > 0 && <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>}
            {crumb.href ? (
              <Link href={crumb.href} className={styles.breadcrumbLink}>{crumb.label}</Link>
            ) : (
              <span className={styles.breadcrumbCurrent}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className={styles.topBarSpacer} />

      <div className={styles.topBarRight}>
        <NavGlobalSearch />
        {shouldShowViewSwitch(pathname) && <ViewModeSwitch compact />}
        {primaryAction && (
          <Link href={primaryAction.href} className={styles.topBarPrimaryAction}>
            <Plus size={14} aria-hidden="true" />
            <span>{primaryAction.label}</span>
          </Link>
        )}
        <div className={styles.notificationWrap}>
          <button
            type="button"
            className={styles.topBarIconButton}
            aria-label="Notifications"
            title="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((value) => !value)}
          >
            <Bell size={15} aria-hidden="true" />
            {unreadNotifications > 0 && (
              <span className={styles.notificationBadge}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>
            )}
          </button>
          {notificationsOpen && (
            <div className={styles.notificationPanel} role="dialog" aria-label="Notifications">
              <div className={styles.notificationHeader}>
                <div>
                  <strong>Notifications</strong>
                  <span>{unreadNotifications} unread</span>
                </div>
                <button
                  type="button"
                  className={styles.notificationMarkRead}
                  onClick={markAllNotificationsRead}
                  disabled={!unreadNotifications}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} aria-hidden="true" />
                  <span>Read all</span>
                </button>
              </div>
              <div className={styles.notificationList}>
                {(notifications?.items ?? []).length ? (notifications?.items ?? []).map((item) => {
                  const content = (
                    <>
                      <span className={`${styles.notificationDot} ${styles[`notificationDot_${item.severity}`] ?? ''}`} aria-hidden="true" />
                      <span className={styles.notificationContent}>
                        <strong>{item.title}</strong>
                        {item.body && <span>{item.body}</span>}
                      </span>
                    </>
                  );
                  return item.href ? (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={styles.notificationRow}
                      onClick={() => {
                        setNotificationsOpen(false);
                        void markNotificationRead(item);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.notificationRow}
                      onClick={() => void markNotificationRead(item)}
                    >
                      {content}
                    </button>
                  );
                }) : (
                  <p className={styles.notificationEmpty}>No notifications yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.topBarIconButton}
          aria-label="Theme switch"
          title={mode === 'dark' ? 'Light theme' : 'Dark theme'}
          onClick={() => setMode(nextThemeMode(mode))}
        >
          {mode === 'dark' ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
        </button>
        {snapshot && (
          <Link href="/user-info" className={styles.topBarUserChip} aria-label="User profile">
            {initials(snapshot)}
          </Link>
        )}
      </div>
    </div>
  );
}
