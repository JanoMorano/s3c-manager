import { MODULE_CODES, type ModuleCode } from './manifest';

export interface DomainModuleOwnership {
  code: ModuleCode;
  featureRoots: string[];
  appRoutes: string[];
}

export const DOMAIN_MODULE_OWNERSHIP: DomainModuleOwnership[] = [
  {
    code: MODULE_CODES.CORE,
    featureRoots: [
      'frontend/features/auth',
      'frontend/features/admin',
      'frontend/features/install',
      'frontend/features/modules',
      'frontend/features/search',
    ],
    appRoutes: [
      '/search',
      '/login',
      '/install',
      '/user-info',
      '/administration',
    ],
  },
  {
    code: MODULE_CODES.SERVICE_CATALOGUE,
    featureRoots: [
      'frontend/features/services',
      'frontend/features/graph',
    ],
    appRoutes: [
      '/catalogue',
      '/services',
      '/import',
      '/graph',
    ],
  },
  {
    code: MODULE_CODES.C3,
    featureRoots: [
      'frontend/features/c3',
      'frontend/features/capabilities',
    ],
    appRoutes: [
      '/c3',
      '/c3-entities',
      '/capabilities',
      '/spirals',
    ],
  },
  {
    code: MODULE_CODES.MANAGEMENT,
    featureRoots: [
      'frontend/features/governance',
    ],
    appRoutes: [
      '/cockpit',
      '/operations',
      '/portfolio',
    ],
  },
];
