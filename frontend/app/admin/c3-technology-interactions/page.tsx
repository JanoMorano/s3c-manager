'use client';

import { C3EntityListPage } from '../c3-entities/C3EntityListPage';
import { c3TechnologyInteractionsConfig } from '../c3-entities/config';
import { buildEntityEditHref, publicC3TechnologyInteractionsConfig } from '../../c3-entities/public-config';

export default function C3TechnologyInteractionsAdminPage() {
  return <C3EntityListPage {...c3TechnologyInteractionsConfig} rowEditHref={(row) => buildEntityEditHref(publicC3TechnologyInteractionsConfig, row)} />;
}
