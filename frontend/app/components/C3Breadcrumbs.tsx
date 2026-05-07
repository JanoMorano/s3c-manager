'use client';

import Link from '@/app/components/AppLink';
import { usePathname, useSearchParams } from 'next/navigation';
import adminStyles from '../admin/admin.module.css';
import { C3_ROUTES, getC3TaxonomyTypeLabel } from '../lib/c3Routes';

const LABELS: Record<string, string> = {
  [C3_ROUTES.list]: 'All C3 List',
  [C3_ROUTES.dashboard]: 'Capability coverage',
  [C3_ROUTES.capabilityMap]: 'C3 Capability Map — Spiral 7',
  [C3_ROUTES.capabilityMapSpiral6]: 'C3 Capability Map — Spiral 6',
  [C3_ROUTES.graph]: 'Capability map',
  [C3_ROUTES.technologyInteractions]: 'C3 Technology Interactions',
  [C3_ROUTES.services]: 'C3 Services',
  [C3_ROUTES.dataObjects]: 'C3 Data Objects',
  [C3_ROUTES.applications]: 'C3 Applications',
};

export default function C3Breadcrumbs() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const filteredTypeLabel = pathname === C3_ROUTES.list
    ? getC3TaxonomyTypeLabel(searchParams?.get('item_type') ?? null)
    : null;
  const label = filteredTypeLabel ?? LABELS[pathname] ?? 'C3';

  return (
    <nav className={adminStyles.breadcrumb}>
      <Link href={C3_ROUTES.list}>C3 Taxonomy</Link>
      {(pathname !== C3_ROUTES.list || filteredTypeLabel) && (
        <>
          <span className={adminStyles.breadcrumbSep}>/</span>
          <span>{label}</span>
        </>
      )}
    </nav>
  );
}
