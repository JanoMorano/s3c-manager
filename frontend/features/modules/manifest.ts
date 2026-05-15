export const MODULE_CODES = {
  DATABASE: 'DATABASE_LAYER',
  CORE: 'PLATFORM_CORE',
  SERVICE_CATALOGUE: 'SERVICE_CATALOGUE_CORE',
  C3: 'C3_TAXONOMY',
  MANAGEMENT: 'MANAGEMENT',
} as const;

export type ModuleCode = typeof MODULE_CODES[keyof typeof MODULE_CODES];

export interface ModuleDefinition {
  code: ModuleCode;
  label: string;
  mandatory: boolean;
  uiVisibleByDefault: boolean;
  routePrefixes: string[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    code: MODULE_CODES.DATABASE,
    label: 'Database Layer',
    mandatory: true,
    uiVisibleByDefault: false,
    routePrefixes: [],
  },
  {
    code: MODULE_CODES.CORE,
    label: 'Platform Core',
    mandatory: true,
    uiVisibleByDefault: true,
    routePrefixes: [
      '/search',
      '/login',
      '/install',
      '/user-info',
      '/administration',
    ],
  },
  {
    code: MODULE_CODES.SERVICE_CATALOGUE,
    label: 'Service Catalogue',
    mandatory: true,
    uiVisibleByDefault: true,
    routePrefixes: [
      '/catalogue',
      '/services',
      '/management/new-service',
      '/import',
      '/admin/import',
      '/administration/import',
      '/administration/catalogue-ref',
    ],
  },
  {
    code: MODULE_CODES.C3,
    label: 'C3 Capability Taxonomy',
    mandatory: false,
    uiVisibleByDefault: false,
    routePrefixes: [
      '/capabilities',
      '/c3',
      '/spirals',
      '/administration/c3-ref',
      '/administration/c3-capability-builder',
      '/admin/c3',
      '/admin/c3-',
    ],
  },
  {
    code: MODULE_CODES.MANAGEMENT,
    label: 'Management Cockpit',
    mandatory: true,
    uiVisibleByDefault: true,
    routePrefixes: [
      '/cockpit/my-tasks',
      '/operations',
      '/portfolio',
    ],
  },
];

export function normalizeModuleCode(moduleCode: string | null | undefined): ModuleCode | string {
  const normalized = String(moduleCode ?? '').trim().toUpperCase();
  if (normalized === 'SERVICE_CATALOGUE' || normalized === 'SERVICE_CATALOG') return MODULE_CODES.SERVICE_CATALOGUE;
  if (normalized === 'C3') return MODULE_CODES.C3;
  if (normalized === 'CORE') return MODULE_CODES.CORE;
  if (normalized === 'DB' || normalized === 'DATABASE') return MODULE_CODES.DATABASE;
  return normalized;
}

export function getModuleDefinition(moduleCode: string | null | undefined) {
  const normalized = normalizeModuleCode(moduleCode);
  return MODULE_DEFINITIONS.find((definition) => definition.code === normalized) ?? null;
}

export function isModuleMandatoryByDefault(moduleCode: string | null | undefined) {
  return getModuleDefinition(moduleCode)?.mandatory === true;
}

export function moduleForPath(pathname: string) {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const matches = MODULE_DEFINITIONS
    .flatMap((definition) => definition.routePrefixes.map((prefix) => ({ definition, prefix })))
    .filter(({ prefix }) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`) || normalizedPath.startsWith(prefix));

  matches.sort((a, b) => b.prefix.length - a.prefix.length);
  return matches[0]?.definition ?? null;
}
