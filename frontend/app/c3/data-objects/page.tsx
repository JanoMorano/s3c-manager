'use client';

import { useEffect, useState } from 'react';
import { C3EntityListPage } from '../../admin/c3-entities/C3EntityListPage';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { filterPublicColumnsByRole, publicC3DataObjectsConfig } from '../../c3-entities/public-config';

export default function C3DataObjectsPage() {
  const [role, setRole] = useState<string | null>(null);
  const isAdmin = hasRoleAccess(role, 'admin');

  useEffect(() => {
    setRole(getAuthSnapshot()?.role ?? null);
  }, []);

  return (
    <C3EntityListPage
      title={publicC3DataObjectsConfig.title}
      subtitle={publicC3DataObjectsConfig.subtitle}
      endpoint={publicC3DataObjectsConfig.endpoint}
      columns={filterPublicColumnsByRole(publicC3DataObjectsConfig.columns, isAdmin)}
      exactSearchKeys={publicC3DataObjectsConfig.exactSearchKeys}
    />
  );
}
