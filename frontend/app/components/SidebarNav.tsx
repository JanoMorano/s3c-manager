'use client';

import Link from '@/app/components/AppLink';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileStack,
  FileText,
  Gauge,
  GitBranch,
  Grid3X3,
  Home,
  Kanban,
  KeyRound,
  Layers,
  List,
  Logs,
  Map,
  Network,
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
import { usePersonaContext } from '@/features/auth/PersonaContext';
import { C3_ROUTES } from '../lib/c3Routes';
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
  const { c3Visible } = useInstallStatus();
  const { persona } = usePersonaContext();
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
  const isConsumerView = persona === 'consumer';
  const isCapabilityView = persona === 'capability_manager' || persona === 'admin';
  const isAdminView = persona === 'admin';
  const showServiceGovernance = !isConsumerView;
  const showArchitecture = c3Visible && (isCapabilityView || canEdit);
  const showImport = canEdit;
  const showAdministration = isAdminRole;

  const isHome           = pathname === '/';
  const isServiceList    = pathname === '/services/list' || pathname === '/services';
  const isServiceDetail  = /^\/services\/[^/]+$/.test(pathname);
  const isNewService     = pathname.startsWith('/management/new-service') || pathname.startsWith('/admin/new-service');
  const isPortfolio      = pathname.startsWith('/portfolio');
  const isCatalogue      = pathname === '/catalogue' || pathname === '/services/dashboard';
  const isServiceGraph   = pathname === '/services/graph' || /^\/services\/[^/]+\/graph$/.test(pathname);
  const isDependencyFlow = pathname.startsWith('/services/dependency-flow');
  const isImpactAnalysis = pathname.startsWith('/services/impact');
  const isConsolidation  = pathname.startsWith('/services/consolidation-matrix');
  const isCapabilities   = pathname === '/capabilities';
  const isCoverage       = pathname.startsWith('/capabilities/coverage');
  const isGaps           = pathname.startsWith('/capabilities/gaps');
  const isOverlaps       = pathname.startsWith('/capabilities/overlaps');
  const isCapMap         = pathname === C3_ROUTES.capabilityMap || pathname === C3_ROUTES.capabilityMapSpiral6 || pathname === C3_ROUTES.capabilityMapSpiral7;
  const isC3Board        = pathname === C3_ROUTES.dashboard || pathname === '/c3-dashboard';
  const isC3Graph        = pathname === C3_ROUTES.graph;
  const isC3List         = pathname === C3_ROUTES.list || pathname.startsWith('/c3/services') || pathname.startsWith('/c3/applications') || pathname.startsWith('/c3/data-objects') || pathname.startsWith('/c3/technology-interactions');
  const isSpirals        = pathname.startsWith('/spirals');
  const isOperations     = pathname === '/operations';
  const isMyTasks        = pathname.startsWith('/cockpit/my-tasks');
  const isReadiness      = pathname.startsWith('/operations/readiness');
  const isReviews        = pathname.startsWith('/operations/reviews');
  const isDecisions      = pathname.startsWith('/operations/decisions');
  const isOwnerLoad      = pathname.startsWith('/operations/owner-load');
  const isAdmin          = pathname.startsWith('/administration');
  const isManagement     = pathname.startsWith('/management');
  const isAdminPages     = pathname.startsWith('/admin') && !pathname.startsWith('/admin/import');
  const isImport         = pathname.startsWith('/import') || pathname.startsWith('/admin/import');
  const activeSection = useMemo(() => {
    if (isHome || isMyTasks) return 'cockpit';
    if (isCatalogue || isPortfolio || isServiceList || isServiceDetail || isServiceGraph || isDependencyFlow || isImpactAnalysis || isConsolidation || isNewService) return 'services';
    if (c3Visible && (isCapabilities || isCoverage || isGaps || isOverlaps || isCapMap || isC3Board || isC3Graph || isC3List || isSpirals)) return 'architecture';
    if (isOperations || isReadiness || isReviews || isDecisions || isOwnerLoad) return 'governance';
    if (isImport) return 'import';
    if (isAdmin || isManagement || isAdminPages) return 'admin';
    return 'cockpit';
  }, [c3Visible, isAdmin, isAdminPages, isCapabilities, isCapMap, isC3Board, isC3Graph, isC3List, isCatalogue, isConsolidation, isCoverage, isDecisions, isDependencyFlow, isGaps, isHome, isImpactAnalysis, isImport, isManagement, isMyTasks, isNewService, isOperations, isOverlaps, isOwnerLoad, isPortfolio, isReadiness, isReviews, isServiceDetail, isServiceGraph, isServiceList, isSpirals]);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(DEFAULT_OPEN_SECTIONS));

  useEffect(() => {
    setOpenSections(readOpenSections());
  }, []);

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
      <NavSection id="cockpit" label="Cockpit" open={openSections.has('cockpit')} onToggle={() => toggleSection('cockpit')}>
        <NavItem href="/" icon={<Home size={16} />} label="Přehled řízení" active={isHome} />
        {showServiceGovernance && <NavItem href="/cockpit/my-tasks" icon={<ClipboardCheck size={16} />} label="Moje úkoly" active={isMyTasks} />}
      </NavSection>

      <NavSection id="services" label="Služby" open={openSections.has('services')} onToggle={() => toggleSection('services')}>
        <NavItem href="/catalogue" icon={<BookOpen size={16} />} label="Katalog služeb" active={isCatalogue} />
        {showServiceGovernance && <NavItem href="/portfolio" icon={<BriefcaseBusiness size={16} />} label="Portfolio" active={isPortfolio} />}
        <NavItem href="/services/list" icon={<List size={16} />} label="Service list" active={isServiceList || isServiceDetail} />
        {showServiceGovernance && <NavItem href="/services/graph" icon={<Network size={16} />} label="Service graph" active={isServiceGraph} />}
        {showServiceGovernance && <NavItem href="/services/dependency-flow" icon={<GitBranch size={16} />} label="Dependency flow" active={isDependencyFlow} />}
        {showServiceGovernance && <NavItem href="/services/impact" icon={<Activity size={16} />} label="Impact analysis" active={isImpactAnalysis} />}
        {showServiceGovernance && <NavItem href="/services/consolidation-matrix" icon={<Grid3X3 size={16} />} label="Konsolidace" active={isConsolidation} />}
        {canEdit && <NavItem href="/management/new-service" icon={<FileStack size={16} />} label="Nová služba" active={isNewService} />}
      </NavSection>

      {showArchitecture && (
        <NavSection id="architecture" label="Schopnosti a C3" open={openSections.has('architecture')} onToggle={() => toggleSection('architecture')}>
          <NavItem href={C3_ROUTES.capabilityMapSpiral7} icon={<Map size={16} />} label="Capability map" active={isCapMap} />
          <NavItem href="/capabilities/coverage" icon={<Gauge size={16} />} label="Coverage" active={isCoverage || isCapabilities} />
          <NavItem href="/capabilities/gaps" icon={<Bell size={16} />} label="Gaps" active={isGaps} />
          <NavItem href="/capabilities/overlaps" icon={<Boxes size={16} />} label="Overlaps" active={isOverlaps} />
          <NavItem href={C3_ROUTES.dashboard} icon={<Kanban size={16} />} label="C3 Board" active={isC3Board} />
          <NavItem href={C3_ROUTES.graph} icon={<Network size={16} />} label="C3 Graph" active={isC3Graph} />
          <NavItem href={C3_ROUTES.list} icon={<List size={16} />} label="C3 List" active={isC3List} />
          <NavItem href="/spirals" icon={<Layers size={16} />} label="Spirals" active={isSpirals} />
        </NavSection>
      )}

      {showServiceGovernance && (
        <NavSection id="governance" label="Governance" open={openSections.has('governance')} onToggle={() => toggleSection('governance')}>
          <NavItem href="/operations" icon={<ShieldCheck size={16} />} label="Operations cockpit" active={isOperations} />
          <NavItem href="/operations/readiness" icon={<ClipboardCheck size={16} />} label="Readiness gate" active={isReadiness} />
          <NavItem href="/operations/reviews" icon={<RefreshCw size={16} />} label="Reviews" active={isReviews} />
          <NavItem href="/operations/decisions" icon={<FileText size={16} />} label="Decisions" active={isDecisions} />
          <NavItem href="/operations/owner-load" icon={<Users size={16} />} label="Owner load" active={isOwnerLoad} />
          {(isCapabilityView || isAdminView) && <NavItem href="/operations" icon={<Activity size={16} />} label="Risk radar" active={false} />}
        </NavSection>
      )}

      {showImport && (
        <NavSection id="import" label="Import a integrace" open={openSections.has('import')} onToggle={() => toggleSection('import')}>
          <NavItem href="/import" icon={<Upload size={16} />} label="Import workspace" active={pathname === '/import'} />
          <NavItem href="/import/upload" icon={<Database size={16} />} label="Upload profilů" active={pathname.startsWith('/import/upload')} />
          <NavItem href="/admin/import" icon={<Wrench size={16} />} label="Profily importu" active={pathname.startsWith('/admin/import')} />
        </NavSection>
      )}

      {showAdministration && (
        <NavSection id="admin" label="Administrace" open={openSections.has('admin')} onToggle={() => toggleSection('admin')}>
          <NavItem href="/administration" icon={<Settings size={16} />} label="Workspace overview" active={pathname === '/administration'} />
          <NavItem href="/administration/users" icon={<UserCog size={16} />} label="Uživatelé" active={pathname.startsWith('/administration/users')} />
          <NavItem href="/admin/groups" icon={<Users size={16} />} label="Skupiny" active={pathname.startsWith('/admin/groups')} />
          <NavItem href="/administration/web" icon={<KeyRound size={16} />} label="Auth / Web / SSO" active={pathname.startsWith('/administration/web')} />
          <NavItem href="/admin/catalogue-ref" icon={<Database size={16} />} label="Reference data" active={pathname.startsWith('/admin/catalogue-ref')} />
          <NavItem href="/management" icon={<BookOpen size={16} />} label="Content admin" active={pathname === '/management'} />
          <NavItem href="/administration/logs" icon={<Logs size={16} />} label="Logy" active={pathname.startsWith('/administration/logs')} />
          <NavItem href="/administration/installation" icon={<Wrench size={16} />} label="Instalace" active={pathname.startsWith('/administration/installation')} />
        </NavSection>
      )}
    </div>
  );
}
