'use client';

import { useState } from 'react';
import { C3EntityListPage } from '../../admin/c3-entities/C3EntityListPage';
import { getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { filterPublicColumnsByRole, publicC3ServicesConfig } from '../../c3-entities/public-config';

export default function C3ServicesPage() {
  const [role] = useState<string | null>(() => getAuthSnapshot()?.role ?? null);
  const isAdmin = hasRoleAccess(role, 'admin');

  return (
    <C3EntityListPage
      title={publicC3ServicesConfig.title}
      subtitle={publicC3ServicesConfig.subtitle}
      endpoint={publicC3ServicesConfig.endpoint}
      columns={filterPublicColumnsByRole(publicC3ServicesConfig.columns, isAdmin)}
      exactSearchKeys={publicC3ServicesConfig.exactSearchKeys}
    />
  );
}
