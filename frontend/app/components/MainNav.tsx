'use client';

import Link from '@/app/components/AppLink';
import { usePathname } from 'next/navigation';
import { useInstallStatus } from '@/features/install/installStatus';
import styles from '../layout.module.css';
import { C3_ROUTES, C3_TAXONOMY_TYPE_OPTIONS, buildC3TaxonomyListHref, isC3Route } from '../lib/c3Routes';

export default function MainNav() {
  const pathname = usePathname() ?? '';
  const { c3Visible } = useInstallStatus();
  const serviceDependencyGraphActive = /^\/services\/[^/]+\/graph$/.test(pathname);
  const serviceActive =
    pathname.startsWith('/services/list') ||
    pathname.startsWith('/services/dashboard') ||
    pathname.startsWith('/services/graph') ||
    serviceDependencyGraphActive ||
    pathname.startsWith('/services/');
  const capabilityMapActive =
    pathname === C3_ROUTES.capabilityMap ||
    pathname === C3_ROUTES.capabilityMapSpiral6 ||
    pathname === C3_ROUTES.capabilityMapSpiral7;
  const c3Active = isC3Route(pathname) && !capabilityMapActive;

  return (
    <div className={styles.navLeft}>
      <div className={styles.navDropdown}>
        <span className={`${styles.navDropdownTrigger} ${serviceActive ? styles.navDropdownTriggerActive : ''}`}>Service Catalogue ▾</span>
        <div className={styles.navDropdownMenu}>
          <Link prefetch={false} href="/services/list" className={`${styles.navDropdownItem} ${pathname === '/services/list' ? styles.navDropdownItemActive : ''}`}>All Services list</Link>
          <Link prefetch={false} href="/services/dashboard" className={`${styles.navDropdownItem} ${pathname === '/services/dashboard' ? styles.navDropdownItemActive : ''}`}>Services Dashboard</Link>
          <Link prefetch={false} href="/services/graph" className={`${styles.navDropdownItem} ${pathname === '/services/graph' ? styles.navDropdownItemActive : ''}`}>Services Graph View</Link>
          <Link prefetch={false} href="/services/DEMO-DAP-003/graph" className={`${styles.navDropdownItem} ${serviceDependencyGraphActive ? styles.navDropdownItemActive : ''}`}>Service Dependency Graph</Link>
        </div>
      </div>

      {c3Visible && (
        <>
          <div className={styles.navDropdown}>
            <span className={`${styles.navDropdownTrigger} ${c3Active ? styles.navDropdownTriggerActive : ''}`}>C3 Taxonomy ▾</span>
            <div className={styles.navDropdownMenu}>
              <Link prefetch={false} href={C3_ROUTES.list} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.list ? styles.navDropdownItemActive : ''}`}>All C3 List</Link>
              <Link prefetch={false} href={C3_ROUTES.dashboard} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.dashboard ? styles.navDropdownItemActive : ''}`}>C3 Dashboard</Link>
              {C3_TAXONOMY_TYPE_OPTIONS.map((option) => (
                <Link
                  key={option.code}
                  prefetch={false}
                  href={buildC3TaxonomyListHref(option.code)}
                  className={styles.navDropdownItem}
                >
                  {option.label}
                </Link>
              ))}
              <Link prefetch={false} href={C3_ROUTES.technologyInteractions} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.technologyInteractions ? styles.navDropdownItemActive : ''}`}>C3 Technology Interactions</Link>
              <Link prefetch={false} href={C3_ROUTES.services} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.services ? styles.navDropdownItemActive : ''}`}>C3 Services</Link>
              <Link prefetch={false} href={C3_ROUTES.dataObjects} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.dataObjects ? styles.navDropdownItemActive : ''}`}>C3 Data Objects</Link>
              <Link prefetch={false} href={C3_ROUTES.applications} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.applications ? styles.navDropdownItemActive : ''}`}>C3 Applications</Link>
            </div>
          </div>

          <div className={styles.navDropdown}>
            <span className={`${styles.navDropdownTrigger} ${capabilityMapActive ? styles.navDropdownTriggerActive : ''}`}>C3 Capability Map ▾</span>
            <div className={styles.navDropdownMenu}>
              <Link prefetch={false} href={C3_ROUTES.capabilityMapSpiral6} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.capabilityMapSpiral6 ? styles.navDropdownItemActive : ''}`}>Spiral 6</Link>
              <Link prefetch={false} href={C3_ROUTES.capabilityMapSpiral7} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.capabilityMapSpiral7 ? styles.navDropdownItemActive : ''}`}>Spiral 7</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
