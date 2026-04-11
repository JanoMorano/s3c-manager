'use client';

import { C3EntityListPage } from '../c3-entities/C3EntityListPage';
import { c3ServicesConfig } from '../c3-entities/config';
import { buildEntityEditHref, publicC3ServicesConfig } from '../../c3-entities/public-config';

export default function C3ServicesAdminPage() {
  return <C3EntityListPage {...c3ServicesConfig} rowEditHref={(row) => buildEntityEditHref(publicC3ServicesConfig, row)} />;
}
