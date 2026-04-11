'use client';

import { C3EntityListPage } from '../c3-entities/C3EntityListPage';
import { c3DataObjectsConfig } from '../c3-entities/config';
import { buildEntityEditHref, publicC3DataObjectsConfig } from '../../c3-entities/public-config';

export default function C3DataObjectsAdminPage() {
  return <C3EntityListPage {...c3DataObjectsConfig} rowEditHref={(row) => buildEntityEditHref(publicC3DataObjectsConfig, row)} />;
}
