export const C3_ROUTES = {
  list: '/c3/list',
  dashboard: '/c3/dashboard',
  capabilityMap: '/c3/capability-map-spiral7',
  capabilityMapSpiral6: '/c3/capability-map-spiral6',
  capabilityMapSpiral7: '/c3/capability-map-spiral7',
  graph: '/c3/graph',
  fmnAirC2: '/c3/fmn-air-c2',
  technologyInteractions: '/c3/technology-interactions',
  services: '/c3/services',
  dataObjects: '/c3/data-objects',
  applications: '/c3/applications',
  legacyList: '/admin/c3',
  legacyDashboard: '/admin/c3/dashboard',
  legacyCapabilityMap: '/c3-dashboard',
  legacyCapabilityMapAlias: '/c3/capability-map',
  legacyTechnologyInteractions: '/admin/c3-technology-interactions',
  legacyServices: '/admin/c3-services',
  legacyDataObjects: '/admin/c3-data-objects',
  legacyApplications: '/admin/c3-application',
} as const;

export const C3_TAXONOMY_TYPE_OPTIONS = [
  { code: 'BP', label: 'C3 Business Processes' },
  { code: 'BR', label: 'C3 Business Roles' },
  { code: 'CP', label: 'C3 Capabilities' },
  { code: 'CI', label: 'C3 COI Services' },
  { code: 'CO', label: 'C3 Communication Services' },
  { code: 'CR', label: 'C3 Core Services' },
  { code: 'IP', label: 'C3 Information Products' },
  { code: 'UA', label: 'C3 User Application' },
] as const;

const C3_TAXONOMY_SORT_STORAGE_KEY = 'c3_taxonomy_list_sort';

export function readStoredC3TaxonomySort(): { sort: string; dir: 'asc' | 'desc' } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(C3_TAXONOMY_SORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sort?: string; dir?: 'asc' | 'desc' };
    if (!parsed?.sort) return null;
    return {
      sort: parsed.sort,
      dir: parsed.dir === 'desc' ? 'desc' : 'asc',
    };
  } catch {
    return null;
  }
}

export function storeC3TaxonomySort(sort: string, dir: 'asc' | 'desc') {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(C3_TAXONOMY_SORT_STORAGE_KEY, JSON.stringify({ sort, dir }));
}

export function buildC3TaxonomyListHref(itemType?: string) {
  const params = new URLSearchParams();
  if (itemType) params.set('item_type', itemType);
  const query = params.toString();
  return query ? `${C3_ROUTES.list}?${query}` : C3_ROUTES.list;
}

export function getC3TaxonomyTypeLabel(itemType?: string | null) {
  return C3_TAXONOMY_TYPE_OPTIONS.find((option) => option.code === itemType)?.label ?? null;
}

export function normalizeLegacyC3Path(pathname: string) {
  if (pathname === C3_ROUTES.legacyDashboard) return C3_ROUTES.dashboard;
  if (pathname === C3_ROUTES.legacyCapabilityMap) return C3_ROUTES.capabilityMap;
  if (pathname === C3_ROUTES.legacyCapabilityMapAlias) return C3_ROUTES.capabilityMap;
  if (pathname === C3_ROUTES.legacyList) return C3_ROUTES.list;
  if (pathname === C3_ROUTES.legacyTechnologyInteractions) return C3_ROUTES.technologyInteractions;
  if (pathname === C3_ROUTES.legacyServices) return C3_ROUTES.services;
  if (pathname === C3_ROUTES.legacyDataObjects) return C3_ROUTES.dataObjects;
  if (pathname === C3_ROUTES.legacyApplications) return C3_ROUTES.applications;
  if (pathname.startsWith('/admin/c3-technology-interactions/')) {
    const code = pathname.slice('/admin/c3-technology-interactions/'.length);
    if (code && !code.includes('/')) return `/c3/technology-interactions/${code}/edit`;
  }
  if (pathname.startsWith('/admin/c3-services/')) {
    const code = pathname.slice('/admin/c3-services/'.length);
    if (code && !code.includes('/')) return `/c3/services/${code}/edit`;
  }
  if (pathname.startsWith('/admin/c3-data-objects/')) {
    const code = pathname.slice('/admin/c3-data-objects/'.length);
    if (code && !code.includes('/')) return `/c3/data-objects/${code}/edit`;
  }
  if (pathname.startsWith('/admin/c3-application/')) {
    const code = pathname.slice('/admin/c3-application/'.length);
    if (code && !code.includes('/')) return `/c3/applications/${code}/edit`;
  }
  if (pathname.startsWith('/admin/c3/')) {
    const slug = pathname.slice('/admin/c3/'.length);
    if (slug && !slug.includes('/')) return `/c3/${slug}/edit`;
  }
  return pathname;
}

export function isC3Route(pathname: string) {
  return pathname.startsWith('/c3/');
}

export interface CapabilityMapRouteState {
  search: string;
  itemType: string;
  application: string;
  mapped: 'all' | 'true';
  selected: string;
}

export function readCapabilityMapRouteState(params: URLSearchParams): CapabilityMapRouteState {
  return {
    search: params.get('search') ?? '',
    itemType: params.get('item_type') ?? '',
    application: params.get('application') ?? '',
    mapped: params.get('mapped') === 'true' ? 'true' : 'all',
    selected: params.get('selected') ?? '',
  };
}

export function buildCapabilityMapHref(params: URLSearchParams, patch: Partial<CapabilityMapRouteState>) {
  const next = new URLSearchParams(params.toString());
  const merged = {
    ...readCapabilityMapRouteState(params),
    ...patch,
  };

  const values = [
    ['search', merged.search],
    ['item_type', merged.itemType],
    ['application', merged.application],
    ['mapped', merged.mapped === 'true' ? 'true' : 'all'],
    ['selected', merged.selected],
  ];

  values.forEach(([key, value]) => {
    if (!value || (key === 'mapped' && value === 'all')) next.delete(key);
    else next.set(key, value);
  });

  const query = next.toString();
  return query ? `${C3_ROUTES.capabilityMap}?${query}` : C3_ROUTES.capabilityMap;
}
