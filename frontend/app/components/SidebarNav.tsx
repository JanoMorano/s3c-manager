'use client';

import Link from '@/app/components/AppLink';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileStack,
  FileText,
  Gauge,
  Home,
  KeyRound,
  List,
  Logs,
  Map,
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react';
import { useInstallStatus } from '@/features/install/installStatus';
import { AUTH_STATE_EVENT, restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useI18n } from '@/app/i18n/useI18n';
import { C3_ROUTES } from '../lib/c3Routes';
import { isHelpPath } from '../lib/helpRoutes';
import styles from '../layout.module.css';

const SIDEBAR_STORAGE_KEY = 'sc_sidebar_sections';
const DEFAULT_OPEN_SECTIONS = ['cockpit', 'services', 'governance'];

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

// ── Collapsible section ───────────────────────────────────────────────────
function NavSection({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.sidebarNavSectionGroup}>
      <button
        type="button"
        className={styles.sidebarNavSectionButton}
        aria-expanded={open}
        aria-controls={`sidebar-section-${id}`}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className={styles.sidebarNavChevron} aria-hidden="true">
          {open ? <ChevronIcon open /> : <ChevronIcon />}
        </span>
      </button>
      {open && (
        <div id={`sidebar-section-${id}`} className={styles.sidebarNavSectionPanel}>
          {children}
        </div>
      )}
    </section>
  );
}

function ChevronIcon({ open = false }: { open?: boolean }) {
  return open ? <ChevronDown size={12} strokeWidth={2.2} /> : <ChevronRight size={12} strokeWidth={2.2} />;
}

function readOpenSections() {
  if (typeof window === 'undefined') return new Set(DEFAULT_OPEN_SECTIONS);
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as string[] : DEFAULT_OPEN_SECTIONS;
    return new Set(parsed.length ? parsed : DEFAULT_OPEN_SECTIONS);
  } catch {
    return new Set(DEFAULT_OPEN_SECTIONS);
  }
}

// ── Component ─────────────────────────────────────────────────────────────
export default function SidebarNav() {
  const pathname = usePathname() ?? '';
  const { t } = useI18n();
  const { c3Visible, serviceCatalogueVisible, managementVisible } = useInstallStatus();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const syncRole = async () => {
      const snapshot = await restoreAuthSession();
      if (!cancelled) setRole(snapshot?.role ?? null);
    };

    void syncRole();
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    window.addEventListener('focus', syncRole);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_STATE_EVENT, syncRole);
      window.removeEventListener('focus', syncRole);
    };
  }, []);

  const canEdit = hasRoleAccess(role, 'editor');
  const isAdminRole = hasRoleAccess(role, 'admin');
  const showServiceCatalogue = serviceCatalogueVisible;
  const showServiceGovernance = managementVisible;
  const showArchitecture = c3Visible && canEdit;
  const showImport = canEdit;
  const showAdministration = isAdminRole;

  const isHome           = pathname === '/';
  const isServiceList    = pathname === '/services/list' || pathname === '/services';
  const isServiceGraph   = pathname === '/services/graph';
  const isServiceDetail  = /^\/services\/(?!list$|graph$|dashboard$|dependency-flow$|impact$|consolidation-matrix$)[^/]+$/.test(pathname);
  const isNewService     = pathname.startsWith('/management/new-service') || pathname.startsWith('/admin/new-service');
  const isPortfolio      = pathname.startsWith('/portfolio');
  const isCatalogue      = pathname === '/catalogue' || pathname === '/services/dashboard';
  const isCapabilities   = pathname === '/capabilities';
  const isCapMap         = pathname === C3_ROUTES.capabilityMap || pathname === C3_ROUTES.capabilityMapSpiral6 || pathname === C3_ROUTES.capabilityMapSpiral7;
  const isC3List         = pathname === C3_ROUTES.list || pathname.startsWith('/c3/services') || pathname.startsWith('/c3/applications') || pathname.startsWith('/c3/data-objects') || pathname.startsWith('/c3/technology-interactions');
  const isSpirals        = pathname.startsWith('/spirals');
  const isOperations     = pathname === '/operations';
  const isMyTasks        = pathname.startsWith('/cockpit/my-tasks');
  const isReadiness      = pathname.startsWith('/operations/readiness');
  const isReviews        = pathname.startsWith('/operations/reviews');
  const isDecisions      = pathname.startsWith('/operations/decisions');
  const isOwnerLoad      = pathname.startsWith('/operations/owner-load');
  const isAdmin          = pathname.startsWith('/administration');
  const isAdminPages     = pathname.startsWith('/admin') && !pathname.startsWith('/admin/import');
  const isImport         = pathname.startsWith('/import') || pathname.startsWith('/administration/import');
  const isHelp           = isHelpPath(pathname);
  const activeSection = useMemo(() => {
    if (isHome || isMyTasks || isHelp) return 'cockpit';
    if (isCatalogue || isPortfolio || isServiceList || isServiceGraph || isServiceDetail || isNewService) return 'services';
    if (c3Visible && (isCapabilities || isCapMap || isC3List || isSpirals)) return 'architecture';
    if (isOperations || isReadiness || isReviews || isDecisions || isOwnerLoad) return 'governance';
    if (isImport) return 'import';
    if (isAdmin || isAdminPages) return 'admin';
    return 'cockpit';
  }, [c3Visible, isAdmin, isAdminPages, isCapabilities, isCapMap, isC3List, isCatalogue, isDecisions, isHelp, isHome, isImport, isMyTasks, isNewService, isOperations, isOwnerLoad, isPortfolio, isReadiness, isReviews, isServiceDetail, isServiceGraph, isServiceList, isSpirals]);
  const [openSections, setOpenSections] = useState<Set<string>>(() => readOpenSections());

  /* eslint-disable react-hooks/set-state-in-effect -- U5: active navigation group must stay open when route changes. */
  useEffect(() => {
    setOpenSections((current) => {
      if (current.has(activeSection)) return current;
      const next = new Set(current);
      next.add(activeSection);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  }, [activeSection]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleSection(id: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  }

  return (
    <div className={styles.sidebarNavList}>
      <NavSection id="cockpit" label={t('nav.sidebar.cockpit')} open={openSections.has('cockpit')} onToggle={() => toggleSection('cockpit')}>
        <NavItem href="/" icon={<Home size={16} />} label={t('nav.sidebar.management_overview')} active={isHome} />
        {showServiceGovernance && <NavItem href="/cockpit/my-tasks" icon={<ClipboardCheck size={16} />} label={t('nav.sidebar.my_tasks')} active={isMyTasks} />}
      </NavSection>

      {showServiceCatalogue && (
        <NavSection id="services" label={t('nav.sidebar.services')} open={openSections.has('services')} onToggle={() => toggleSection('services')}>
          <NavItem href="/catalogue" icon={<BookOpen size={16} />} label={t('nav.sidebar.service_catalogue')} active={isCatalogue} />
          {showServiceGovernance && <NavItem href="/portfolio" icon={<BriefcaseBusiness size={16} />} label={t('nav.sidebar.portfolio')} active={isPortfolio} />}
          <NavItem href="/services/list" icon={<List size={16} />} label={t('nav.sidebar.service_list')} active={isServiceList || isServiceDetail} />
          <NavItem href="/services/graph" icon={<Map size={16} />} label={t('nav.sidebar.service_graph')} active={isServiceGraph} />
          {canEdit && <NavItem href="/management/new-service" icon={<FileStack size={16} />} label={t('nav.sidebar.new_service')} active={isNewService} />}
        </NavSection>
      )}

      {showArchitecture && (
        <NavSection id="architecture" label={t('nav.sidebar.architecture')} open={openSections.has('architecture')} onToggle={() => toggleSection('architecture')}>
          <NavItem href="/capabilities" icon={<Gauge size={16} />} label={t('nav.sidebar.capabilities_workspace')} active={isCapabilities} />
          <NavItem href={C3_ROUTES.capabilityMapSpiral7} icon={<Map size={16} />} label={t('nav.sidebar.capability_maps')} active={isCapMap} />
          {isAdminRole && <NavItem href={C3_ROUTES.list} icon={<List size={16} />} label={t('nav.sidebar.expert_c3_reference')} active={isC3List || isSpirals} />}
        </NavSection>
      )}

      {showServiceGovernance && (
        <NavSection id="governance" label={t('nav.sidebar.governance')} open={openSections.has('governance')} onToggle={() => toggleSection('governance')}>
          <NavItem href="/operations" icon={<ShieldCheck size={16} />} label={t('nav.sidebar.operations_cockpit')} active={isOperations} />
          <NavItem href="/operations/readiness" icon={<ClipboardCheck size={16} />} label={t('nav.sidebar.readiness_gate')} active={isReadiness} />
          <NavItem href="/operations/reviews" icon={<RefreshCw size={16} />} label={t('nav.sidebar.reviews')} active={isReviews} />
          <NavItem href="/operations/decisions" icon={<FileText size={16} />} label={t('nav.sidebar.decisions')} active={isDecisions} />
        </NavSection>
      )}

      {showImport && (
        <NavSection id="import" label={t('nav.sidebar.import_integrations')} open={openSections.has('import')} onToggle={() => toggleSection('import')}>
          <NavItem href="/import" icon={<Upload size={16} />} label={t('nav.sidebar.import_workspace')} active={pathname === '/import'} />
          <NavItem href="/import/upload" icon={<Database size={16} />} label={t('nav.sidebar.upload_profiles')} active={pathname.startsWith('/import/upload')} />
          <NavItem href="/administration/import" icon={<Wrench size={16} />} label={t('nav.sidebar.import_profiles')} active={pathname.startsWith('/administration/import')} />
        </NavSection>
      )}

      {showAdministration && (
        <NavSection id="admin" label={t('nav.sidebar.administration')} open={openSections.has('admin')} onToggle={() => toggleSection('admin')}>
          <NavItem href="/administration" icon={<Settings size={16} />} label={t('nav.sidebar.workspace_overview')} active={pathname === '/administration'} />
          <NavItem href="/administration/users" icon={<UserCog size={16} />} label={t('nav.sidebar.users')} active={pathname.startsWith('/administration/users')} />
          <NavItem href="/administration/groups" icon={<Users size={16} />} label={t('nav.sidebar.groups')} active={pathname.startsWith('/administration/groups')} />
          <NavItem href="/administration/web" icon={<KeyRound size={16} />} label={t('nav.sidebar.auth_web_sso')} active={pathname.startsWith('/administration/web')} />
          <NavItem href="/administration/catalogue-ref" icon={<Database size={16} />} label={t('nav.sidebar.reference_data')} active={pathname.startsWith('/administration/catalogue-ref')} />
          <NavItem href="/administration/logs" icon={<Logs size={16} />} label={t('nav.sidebar.logs')} active={pathname.startsWith('/administration/logs')} />
          <NavItem href="/administration/installation" icon={<Wrench size={16} />} label={t('nav.sidebar.installation')} active={pathname.startsWith('/administration/installation')} />
        </NavSection>
      )}
    </div>
  );
}
