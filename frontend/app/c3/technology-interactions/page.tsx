'use client';

import { useEffect, useState } from 'react';
import { C3EntityListPage } from '../../admin/c3-entities/C3EntityListPage';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { buildEntityEditHref, filterPublicColumnsByRole, publicC3TechnologyInteractionsConfig } from '../../c3-entities/public-config';

export default function C3TechnologyInteractionsPage() {
  const [role, setRole] = useState<string | null>(null);
  const isAdmin = hasRoleAccess(role, 'admin');
  const canEdit = isAdmin || hasRoleAccess(role, 'editor');

  useEffect(() => {
    setRole(getAuthSnapshot()?.role ?? null);
  }, []);

  return (
    <C3EntityListPage
      title={publicC3TechnologyInteractionsConfig.title}
      subtitle={publicC3TechnologyInteractionsConfig.subtitle}
      endpoint={publicC3TechnologyInteractionsConfig.endpoint}
      columns={filterPublicColumnsByRole(publicC3TechnologyInteractionsConfig.columns, isAdmin)}
      exactSearchKeys={publicC3TechnologyInteractionsConfig.exactSearchKeys}
      rowEditHref={canEdit ? (row) => buildEntityEditHref(publicC3TechnologyInteractionsConfig, row) : undefined}
    />
  );
}
