'use client';

import { useEffect, useState } from 'react';
import { C3EntityListPage } from '../../admin/c3-entities/C3EntityListPage';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { filterPublicColumnsByRole, publicC3ApplicationsConfig } from '../../c3-entities/public-config';

export default function C3ApplicationsPage() {
  const [role, setRole] = useState<string | null>(null);
  const isAdmin = hasRoleAccess(role, 'admin');

  useEffect(() => {
    setRole(getAuthSnapshot()?.role ?? null);
  }, []);

  return (
    <C3EntityListPage
      title={publicC3ApplicationsConfig.title}
      subtitle={publicC3ApplicationsConfig.subtitle}
      endpoint={publicC3ApplicationsConfig.endpoint}
      columns={filterPublicColumnsByRole(publicC3ApplicationsConfig.columns, isAdmin)}
      exactSearchKeys={publicC3ApplicationsConfig.exactSearchKeys}
    />
  );
}
