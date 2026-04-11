'use client';

import { C3EntityListPage } from '../c3-entities/C3EntityListPage';
import { c3ApplicationsConfig } from '../c3-entities/config';
import { buildEntityEditHref, publicC3ApplicationsConfig } from '../../c3-entities/public-config';

export default function C3ApplicationAdminPage() {
  return <C3EntityListPage {...c3ApplicationsConfig} rowEditHref={(row) => buildEntityEditHref(publicC3ApplicationsConfig, row)} />;
}
