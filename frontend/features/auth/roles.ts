export type AppRole = 'viewer' | 'editor' | 'admin'

export const ROLE_LEVELS: Record<AppRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
}

/** i18n keys for role labels; translate with t() at render time. */
export const ROLE_LABELS: Record<AppRole, string> = {
  viewer: 'administration.users.role.viewer.label',
  editor: 'administration.users.role.editor.label',
  admin: 'administration.users.role.admin.label',
}

/** i18n keys for role access descriptions; translate with t() at render time. */
export const ROLE_ACCESS_LABELS: Record<AppRole, string> = {
  viewer: 'administration.users.role.viewer.access',
  editor: 'administration.users.role.editor.access',
  admin: 'administration.users.role.admin.access',
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
    pathname.startsWith('/admin/c3-technology-interactions/')
  ) return 'editor'
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin'
  return null
}
