'use client';

import Link from '@/app/components/AppLink';
import { ArrowRight, Moon, Plus, Sun } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AUTH_STATE_EVENT, restoreAuthSession, type AuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useTheme, type ThemeMode } from '@/features/theme/ThemeContext';
import { useT } from '@/app/i18n/useI18n';
import NavGlobalSearch from './NavGlobalSearch';
import styles from '../layout.module.css';

const APP_TITLE = 'S3C Manager';

interface Crumb {
  label: string;
  href?: string;
}

const SEGMENT_LABEL_KEYS: Record<string, string> = {
  admin: 'nav.topbar.segment.administration',
  administration: 'nav.topbar.segment.administration',
  capabilities: 'nav.topbar.segment.capabilities',
  catalogue: 'nav.topbar.segment.catalogue',
  coverage: 'nav.topbar.segment.coverage',
  decisions: 'nav.topbar.segment.decisions',
  edit: 'nav.topbar.segment.edit',
  history: 'nav.topbar.segment.history',
  'dependency-flow': 'nav.topbar.segment.dependency_flow',
  gaps: 'nav.topbar.segment.gaps',
  graph: 'nav.topbar.segment.graph',
  groups: 'nav.topbar.segment.groups',
  impact: 'nav.topbar.segment.impact',
  import: 'nav.topbar.segment.import',
  installation: 'nav.topbar.segment.installation',
  list: 'nav.topbar.segment.list',
  logs: 'nav.topbar.segment.logs',
  management: 'nav.topbar.segment.management',
  'new-service': 'nav.topbar.segment.new_service',
  operations: 'nav.topbar.segment.operations',
  overlaps: 'nav.topbar.segment.overlaps',
  'owner-load': 'nav.topbar.segment.owner_load',
  portfolio: 'nav.topbar.segment.portfolio',
  readiness: 'nav.topbar.segment.readiness',
  request: 'nav.topbar.segment.request',
  reviews: 'nav.topbar.segment.reviews',
  search: 'nav.topbar.segment.search',
  services: 'nav.topbar.segment.services',
  spirals: 'nav.topbar.segment.spirals',
  upload: 'nav.topbar.segment.upload',
  users: 'nav.topbar.segment.users',
  web: 'nav.topbar.segment.web',
};

function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'dark' ? 'light' : 'dark';
}

type Translate = ReturnType<typeof useT>;

function titleFromSegment(segment: string, t: Translate) {
  const key = SEGMENT_LABEL_KEYS[segment];
  return key ? t(key) : decodeURIComponent(segment).replaceAll('-', ' ');
}

// Path prefixes that only group child routes and have no page of their own;
// linking them from the breadcrumb would lead to a 404.
const NO_INDEX_ROUTES = new Set(['/admin', '/c3', '/c3-entities', '/cockpit', '/management']);

function normalizeBreadcrumbHref(href: string) {
  if (href === '/services') return '/services/list';
  return href;
}

function titleForBreadcrumb(segment: string, href: string, t: Translate) {
  if (href === '/services/graph') return t('nav.topbar.service_graph');
  if (href === '/services/list') return t('nav.topbar.segment.list');
  if (href === '/c3/list') return t('nav.topbar.c3_reference');
  if (/^\/services\/[^/]+$/.test(href)) return decodeURIComponent(segment);
  return titleFromSegment(segment, t);
}

function buildBreadcrumbs(pathname: string, t: Translate, graphView?: string | null): Crumb[] {
  if (pathname === '/') return [{ label: 'S3C Manager', href: '/' }, { label: t('nav.topbar.governance_overview') }];

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'S3C Manager', href: '/' }];
  let href = '';

  segments.slice(0, 3).forEach((segment, index) => {
    href += `/${segment}`;
    const isLast = index === Math.min(segments.length, 3) - 1;
    crumbs.push({
      label: titleForBreadcrumb(segment, href, t),
      href: isLast || NO_INDEX_ROUTES.has(href) ? undefined : normalizeBreadcrumbHref(href),
    });
  });

  if (graphView === 'graph-only') {
    if (pathname === '/services/graph') {
      crumbs.push({ label: t('nav.topbar.show_menu'), href: '/services/graph' });
    } else if (/^\/services\/[^/]+\/graph$/.test(pathname)) {
      crumbs.push({ label: t('nav.topbar.show_menu'), href: pathname });
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

function primaryActionFor(pathname: string, isEditor: boolean): { href: string; labelKey: string } | null {
  const serviceId = serviceIdFromPath(pathname);
  if (serviceId) return { href: '#request', labelKey: 'nav.topbar.action.how_to_get_service' };
  if (pathname.startsWith('/operations/readiness')) return { href: `${pathname}?filter=blocked`, labelKey: 'nav.topbar.action.review_blockers' };
  if (pathname.startsWith('/operations')) return { href: '/operations/decisions', labelKey: 'nav.topbar.action.record_decision' };
  if (pathname.startsWith('/services/list')) return { href: isEditor ? '/management/new-service' : '/catalogue', labelKey: isEditor ? 'nav.topbar.action.new_service' : 'nav.topbar.action.browse_catalogue' };
  if (pathname.startsWith('/catalogue')) return { href: '/services/list', labelKey: 'nav.topbar.action.browse_services' };
  if (pathname.startsWith('/capabilities')) return { href: '/capabilities?view=coverage', labelKey: 'nav.topbar.action.open_coverage' };
  if (pathname.startsWith('/import')) return { href: '/import/upload', labelKey: 'nav.topbar.action.upload_data' };
  if (isEditor) return { href: '/management/new-service', labelKey: 'nav.topbar.action.new_service' };
  return { href: '/catalogue', labelKey: 'nav.topbar.action.browse_catalogue' };
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
  const t = useT();
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

  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname, t, graphView), [pathname, t, graphView]);
  const isEditor = hasRoleAccess(snapshot?.role ?? null, 'editor');
  const primaryAction = primaryActionFor(pathname, isEditor);

  // Name the browser tab after the page heading so several open tabs (and
  // history entries) can be told apart. Headings often render after data
  // loads, so follow changes inside <main> until the route changes.
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    const update = () => {
      const heading = main.querySelector('h1')?.textContent?.trim();
      const next = heading ? `${heading} · ${APP_TITLE}` : APP_TITLE;
      if (document.title !== next) document.title = next;
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div className={styles.topBar} role="banner">
      <nav className={styles.topBarBreadcrumbs} aria-label={t('nav.topbar.breadcrumb')}>
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className={styles.breadcrumbItem}>
            {index > 0 && <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>}
            {crumb.href ? (
              <Link href={crumb.href} className={styles.breadcrumbLink}>{crumb.label}</Link>
            ) : index === breadcrumbs.length - 1 ? (
              <span className={styles.breadcrumbCurrent} aria-current="page">{crumb.label}</span>
            ) : (
              <span className={styles.breadcrumbText}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className={styles.topBarSpacer} />

      <div className={styles.topBarRight}>
        <NavGlobalSearch />
        {primaryAction && (
          <Link href={primaryAction.href} className={styles.topBarPrimaryAction}>
            {primaryAction.href === '/management/new-service'
              ? <Plus size={14} aria-hidden="true" />
              : <ArrowRight size={14} aria-hidden="true" />}
            <span>{t(primaryAction.labelKey)}</span>
          </Link>
        )}
        <button
          type="button"
          className={styles.topBarIconButton}
          aria-label={t('nav.topbar.theme_switch')}
          title={mode === 'dark' ? t('nav.topbar.theme_light') : t('nav.topbar.theme_dark')}
          onClick={() => setMode(nextThemeMode(mode))}
        >
          {mode === 'dark' ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
        </button>
        {snapshot && (
          <Link href="/user-info" className={styles.topBarUserChip} aria-label={t('nav.topbar.user_profile')}>
            {initials(snapshot)}
          </Link>
        )}
      </div>
    </div>
  );
}
