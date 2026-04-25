'use client';

import Link from '@/app/components/AppLink';
import { usePathname } from 'next/navigation';
import { useT } from '@/app/i18n/useI18n';
import { useInstallStatus } from '@/features/install/installStatus';
import { C3_ROUTES, isC3Route, buildC3TaxonomyListHref, C3_TAXONOMY_TYPE_OPTIONS } from '../lib/c3Routes';
import styles from '../layout.module.css';

// ── Tiny inline SVG icons ──────────────────────────────────────────────────
function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity=".7"/>
    </svg>
  );
}
function IconList() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="13" height="1.5" rx=".75" fill="currentColor" opacity=".7"/>
      <rect x="1" y="6.75" width="13" height="1.5" rx=".75" fill="currentColor" opacity=".7"/>
      <rect x="1" y="11.5" width="13" height="1.5" rx=".75" fill="currentColor" opacity=".7"/>
    </svg>
  );
}
function IconGraph() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" fill="currentColor" opacity=".7"/>
      <circle cx="2" cy="4" r="1.5" fill="currentColor" opacity=".5"/>
      <circle cx="13" cy="4" r="1.5" fill="currentColor" opacity=".5"/>
      <circle cx="2" cy="11" r="1.5" fill="currentColor" opacity=".5"/>
      <circle cx="13" cy="11" r="1.5" fill="currentColor" opacity=".5"/>
      <line x1="5.6" y1="6.5" x2="3" y2="5" stroke="currentColor" strokeWidth="1" opacity=".4"/>
      <line x1="9.4" y1="6.5" x2="12" y2="5" stroke="currentColor" strokeWidth="1" opacity=".4"/>
      <line x1="5.6" y1="8.5" x2="3" y2="10" stroke="currentColor" strokeWidth="1" opacity=".4"/>
      <line x1="9.4" y1="8.5" x2="12" y2="10" stroke="currentColor" strokeWidth="1" opacity=".4"/>
    </svg>
  );
}
function IconMap() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M1 3L5 1.5L10 3.5L14 2V12L10 13.5L5 11.5L1 13V3Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fill="none" opacity=".7"/>
    </svg>
  );
}
function IconCog() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" opacity=".8"/>
      <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M2.9 2.9l1.4 1.4M10.7 10.7l1.4 1.4M2.9 12.1l1.4-1.4M10.7 4.3l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" opacity=".7"/>
      <path d="M1 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
      <path d="M10 7c1.5 0 3 .8 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".5"/>
      <circle cx="10.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2" opacity=".5"/>
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 9V2M4.5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/>
      <path d="M2 10v2a1 1 0 001 1h9a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
    </svg>
  );
}
function IconTaxonomy() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="4" height="3" rx="1" fill="currentColor" opacity=".5"/>
      <rect x="5.5" y="5.5" width="4" height="3" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="10" y="10" width="4" height="3" rx="1" fill="currentColor" opacity=".5"/>
      <path d="M3 4v2.5h4M7.5 8.5V11h4" stroke="currentColor" strokeWidth="1" opacity=".4"/>
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5l1.5 4h4l-3.2 2.3 1.2 3.7-3.5-2.5-3.5 2.5 1.2-3.7L2 5.5h4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity=".7"/>
    </svg>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────
function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={`${styles.sidebarNavItem} ${active ? styles.sidebarNavItemActive : ''}`}
    >
      <span className={styles.sidebarNavIcon}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

// ── Section label ─────────────────────────────────────────────────────────
function NavSection({ label }: { label: string }) {
  return <div className={styles.sidebarNavSection}>{label}</div>;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function SidebarNav() {
  const t = useT();
  const pathname = usePathname() ?? '';
  const { c3Visible } = useInstallStatus();

  const isServiceList    = pathname === '/services/list' || pathname === '/services';
  const isServiceDash    = pathname === '/services/dashboard';
  const isServiceGraph   = pathname === '/services/graph' || /^\/services\/[^/]+\/graph$/.test(pathname);
  const isC3             = isC3Route(pathname);
  const isCapMap         = pathname.startsWith('/c3/');
  const isAdmin          = pathname.startsWith('/administration');
  const isManagement     = pathname.startsWith('/management');
  const isImport         = pathname.startsWith('/import');

  return (
    <div className={styles.sidebarNavList}>
      <NavSection label={t('nav.service_catalogue')} />
      <NavItem href="/services/list"      icon={<IconList />}  label={t('nav.services_list')}      active={isServiceList} />
      <NavItem href="/services/dashboard" icon={<IconGrid />}  label={t('nav.services_dashboard')} active={isServiceDash} />
      <NavItem href="/services/graph"     icon={<IconGraph />} label={t('nav.services_graph')}     active={isServiceGraph} />

      {c3Visible && (
        <>
          <NavSection label={t('nav.c3_taxonomy')} />
          <NavItem href={C3_ROUTES.list}      icon={<IconList />}     label={t('nav.c3_list')}      active={pathname === C3_ROUTES.list} />
          <NavItem href={C3_ROUTES.dashboard} icon={<IconGrid />}     label={t('nav.c3_dashboard')} active={pathname === C3_ROUTES.dashboard} />
          <NavItem href={C3_ROUTES.capabilityMapSpiral7} icon={<IconMap />} label={t('nav.c3_capability_map')} active={isCapMap} />
          {C3_TAXONOMY_TYPE_OPTIONS.slice(0, 3).map((opt) => (
            <NavItem
              key={opt.code}
              href={buildC3TaxonomyListHref(opt.code)}
              icon={<IconTaxonomy />}
              label={opt.label}
              active={pathname.includes(opt.code)}
            />
          ))}
        </>
      )}

      <NavSection label={t('nav.administration')} />
      <NavItem href="/administration" icon={<IconCog />}    label={t('nav.administration')} active={isAdmin} />
      <NavItem href="/management"     icon={<IconStar />}   label={t('nav.content_admin')}  active={isManagement} />
      <NavItem href="/import"         icon={<IconUpload />} label="Import"                   active={isImport} />
    </div>
  );
}
