'use client';

import Link from '@/app/components/AppLink';
import { Moon, Plus, Sun } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AUTH_STATE_EVENT, restoreAuthSession, type AuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useTheme, type ThemeMode } from '@/features/theme/ThemeContext';
import NavGlobalSearch from './NavGlobalSearch';
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
  'dependency-flow': 'Relationships',
  gaps: 'Gaps',
  graph: 'Relationships',
  groups: 'Skupiny',
  impact: 'Service relationships',
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

function normalizeBreadcrumbHref(href: string) {
  if (href === '/services') return '/services/list';
  return href;
}

function titleForBreadcrumb(segment: string, href: string) {
  if (href === '/services/graph') return 'Service graph';
  if (href === '/services/list') return 'Service list';
  if (/^\/services\/[^/]+$/.test(href)) return decodeURIComponent(segment);
  return titleFromSegment(segment);
}

function buildBreadcrumbs(pathname: string, graphView?: string | null): Crumb[] {
  if (pathname === '/') return [{ label: 'S3C Manager', href: '/' }, { label: 'Přehled řízení' }];

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'S3C Manager', href: '/' }];
  let href = '';

  segments.slice(0, 3).forEach((segment, index) => {
    href += `/${segment}`;
    const isLast = index === Math.min(segments.length, 3) - 1;
    crumbs.push({
      label: titleForBreadcrumb(segment, href),
      href: isLast ? undefined : normalizeBreadcrumbHref(href),
    });
  });

  if (graphView === 'graph-only') {
    if (pathname === '/services/graph') {
      crumbs.push({ label: 'Zobrazit menu', href: '/services/graph' });
    } else if (/^\/services\/[^/]+\/graph$/.test(pathname)) {
      crumbs.push({ label: 'Zobrazit menu', href: pathname });
    }
  }

  return crumbs;
}

function serviceIdFromPath(pathname: string) {
  const match = pathname.match(/^\/services\/([^/]+)$/);
  const id = match?.[1] ?? null;
  if (id && ['list', 'graph', 'dashboard', 'dependency-flow', 'impact', 'consolidation-matrix'].includes(id)) return null;
  return id;
}

function primaryActionFor(pathname: string, isEditor: boolean): { href: string; label: string } | null {
  const serviceId = serviceIdFromPath(pathname);
  if (serviceId) return { href: '#request', label: 'How to get service' };
  if (pathname.startsWith('/operations/readiness')) return { href: `${pathname}?filter=blocked`, label: 'Review blockers' };
  if (pathname.startsWith('/operations')) return { href: '/operations/decisions', label: 'Record decision' };
  if (pathname.startsWith('/services/list')) return { href: isEditor ? '/management/new-service' : '/catalogue', label: isEditor ? 'New service' : 'Browse catalogue' };
  if (pathname.startsWith('/catalogue')) return { href: '/services/list', label: 'Browse services' };
  if (pathname.startsWith('/capabilities')) return { href: '/capabilities?view=coverage', label: 'Open coverage' };
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
  const searchParams = useSearchParams();
  const graphView = searchParams?.get('view') ?? null;
  const { mode, setMode } = useTheme();
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(null);

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

  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname, graphView), [pathname, graphView]);
  const isEditor = hasRoleAccess(snapshot?.role ?? null, 'editor');
  const primaryAction = primaryActionFor(pathname, isEditor);

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
        {primaryAction && (
          <Link href={primaryAction.href} className={styles.topBarPrimaryAction}>
            <Plus size={14} aria-hidden="true" />
            <span>{primaryAction.label}</span>
          </Link>
        )}
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
