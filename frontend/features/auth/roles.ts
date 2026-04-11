export type AppRole = 'viewer' | 'editor' | 'admin'

export const ROLE_LEVELS: Record<AppRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
}

export const ROLE_LABELS: Record<AppRole, string> = {
  viewer: 'User - RO',
  editor: 'Content Admin - RW',
  admin: 'Admin - ALL',
}

export const ROLE_ACCESS_LABELS: Record<AppRole, string> = {
  viewer: 'Read-only přístup do katalogu',
  editor: 'Read/write + přístup do Content Admin',
  admin: 'ALL + přístup do Administration',
}

export function hasRoleAccess(role: string | null | undefined, requiredRole: AppRole): boolean {
  if (!role) return false
  const normalized = role as AppRole
  return (ROLE_LEVELS[normalized] ?? 0) >= ROLE_LEVELS[requiredRole]
}

export function requiredRoleForPath(pathname: string): AppRole | null {
  if (pathname === '/administration' || pathname.startsWith('/administration/')) return 'admin'
  if (pathname === '/management' || pathname.startsWith('/management/')) return 'editor'
  if (pathname === '/import/upload' || pathname.startsWith('/import/upload/')) return 'editor'
  if (/^\/c3\/[^/]+\/edit$/.test(pathname)) return 'editor'
  if (/^\/c3\/(services|applications|data-objects|technology-interactions)\/[^/]+\/edit$/.test(pathname)) return 'editor'
  if (
    pathname === '/admin/c3' ||
    pathname.startsWith('/admin/c3/') ||
    pathname === '/admin/c3-services' ||
    pathname.startsWith('/admin/c3-services/') ||
    pathname === '/admin/c3-application' ||
    pathname.startsWith('/admin/c3-application/') ||
    pathname === '/admin/c3-data-objects' ||
    pathname.startsWith('/admin/c3-data-objects/') ||
    pathname === '/admin/c3-technology-interactions' ||
    pathname.startsWith('/admin/c3-technology-interactions/') ||
    pathname === '/admin/c3-capability-builder' ||
    pathname === '/admin/c3-capability-builder2' ||
    pathname === '/admin/c3-ref'
  ) return 'editor'
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin'
  return null
}
