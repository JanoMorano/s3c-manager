'use client';

import Link from '@/app/components/AppLink';
import { usePathname, useSearchParams } from 'next/navigation';
import adminStyles from '../admin/admin.module.css';
import { C3_ROUTES, getC3TaxonomyTypeLabel } from '../lib/c3Routes';
import { useT } from '@/app/i18n/useI18n';

type Translate = ReturnType<typeof useT>;

function labelForPath(pathname: string, t: Translate): string | null {
  switch (pathname) {
    case C3_ROUTES.list: return t('nav.c3_all_list');
    case C3_ROUTES.dashboard: return t('nav.c3_capability_coverage');
    case C3_ROUTES.capabilityMap: return `${t('nav.c3_capability_map')} — ${t('nav.capability_map_spiral_7')}`;
    case C3_ROUTES.capabilityMapSpiral6: return `${t('nav.c3_capability_map')} — ${t('nav.capability_map_spiral_6')}`;
    case C3_ROUTES.technologyInteractions: return t('nav.c3_technology_interactions');
    case C3_ROUTES.services: return t('nav.c3_services');
    case C3_ROUTES.dataObjects: return t('nav.c3_data_objects');
    case C3_ROUTES.applications: return t('nav.c3_applications');
    default: return null;
  }
}

export default function C3Breadcrumbs() {
  const pathname = usePathname() ?? '';
  const t = useT();
  const searchParams = useSearchParams();
  const filteredTypeLabel = pathname === C3_ROUTES.list
    ? getC3TaxonomyTypeLabel(searchParams?.get('item_type') ?? null, t)
    : null;
  const label = filteredTypeLabel ?? labelForPath(pathname, t) ?? 'C3';

  return (
    <nav className={adminStyles.breadcrumb}>
      <Link href={C3_ROUTES.list}>{t('nav.c3_taxonomy')}</Link>
      {(pathname !== C3_ROUTES.list || filteredTypeLabel) && (
        <>
          <span className={adminStyles.breadcrumbSep}>/</span>
          <span>{label}</span>
        </>
      )}
    </nav>
  );
}
