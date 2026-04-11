'use client';

import Link from '@/app/components/AppLink';
import { usePathname } from 'next/navigation';
import { useT } from '@/app/i18n/useI18n';
import { useInstallStatus } from '@/features/install/installStatus';
import styles from '../layout.module.css';
import { C3_ROUTES, C3_TAXONOMY_TYPE_OPTIONS, buildC3TaxonomyListHref, isC3Route } from '../lib/c3Routes';

export default function MainNav() {
  const t = useT();
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
        <span className={`${styles.navDropdownTrigger} ${serviceActive ? styles.navDropdownTriggerActive : ''}`}>{t('nav.service_catalogue')} ▾</span>
        <div className={styles.navDropdownMenu}>
          <Link prefetch={false} href="/services/list" className={`${styles.navDropdownItem} ${pathname === '/services/list' ? styles.navDropdownItemActive : ''}`}>{t('nav.services_list')}</Link>
          <Link prefetch={false} href="/services/dashboard" className={`${styles.navDropdownItem} ${pathname === '/services/dashboard' ? styles.navDropdownItemActive : ''}`}>{t('nav.services_dashboard')}</Link>
          <Link prefetch={false} href="/services/graph" className={`${styles.navDropdownItem} ${pathname === '/services/graph' ? styles.navDropdownItemActive : ''}`}>{t('nav.services_graph')}</Link>
          <Link prefetch={false} href="/services/DEMO-DAP-003/graph" className={`${styles.navDropdownItem} ${serviceDependencyGraphActive ? styles.navDropdownItemActive : ''}`}>{t('nav.service_dependency_graph')}</Link>
        </div>
      </div>

      {c3Visible && (
        <>
          <div className={styles.navDropdown}>
            <span className={`${styles.navDropdownTrigger} ${c3Active ? styles.navDropdownTriggerActive : ''}`}>{t('nav.c3_taxonomy')} ▾</span>
            <div className={styles.navDropdownMenu}>
              <Link prefetch={false} href={C3_ROUTES.list} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.list ? styles.navDropdownItemActive : ''}`}>{t('nav.c3_list')}</Link>
              <Link prefetch={false} href={C3_ROUTES.dashboard} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.dashboard ? styles.navDropdownItemActive : ''}`}>{t('nav.c3_dashboard')}</Link>
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
              <Link prefetch={false} href={C3_ROUTES.technologyInteractions} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.technologyInteractions ? styles.navDropdownItemActive : ''}`}>{t('nav.c3_technology_interactions')}</Link>
              <Link prefetch={false} href={C3_ROUTES.services} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.services ? styles.navDropdownItemActive : ''}`}>{t('nav.c3_services')}</Link>
              <Link prefetch={false} href={C3_ROUTES.dataObjects} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.dataObjects ? styles.navDropdownItemActive : ''}`}>{t('nav.c3_data_objects')}</Link>
              <Link prefetch={false} href={C3_ROUTES.applications} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.applications ? styles.navDropdownItemActive : ''}`}>{t('nav.c3_applications')}</Link>
            </div>
          </div>

          <div className={styles.navDropdown}>
            <span className={`${styles.navDropdownTrigger} ${capabilityMapActive ? styles.navDropdownTriggerActive : ''}`}>{t('nav.c3_capability_map')} ▾</span>
            <div className={styles.navDropdownMenu}>
              <Link prefetch={false} href={C3_ROUTES.capabilityMapSpiral6} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.capabilityMapSpiral6 ? styles.navDropdownItemActive : ''}`}>{t('nav.capability_map_spiral_6')}</Link>
              <Link prefetch={false} href={C3_ROUTES.capabilityMapSpiral7} className={`${styles.navDropdownItem} ${pathname === C3_ROUTES.capabilityMapSpiral7 ? styles.navDropdownItemActive : ''}`}>{t('nav.capability_map_spiral_7')}</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
