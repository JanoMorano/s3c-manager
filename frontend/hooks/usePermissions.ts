/**
 * usePermissions — načte skupiny a permissions aktuálního uživatele.
 *
 * Použití:
 *   const { canView, canEdit, canEditRef, isLoading } = usePermissions()
 *   if (canView('service_catalogue', 'pricing_variants')) { ... }
 *
 * Enforcement ve stránkách je Phase 2. Tento hook je stub připravený pro integraci.
 */
import useSWR from 'swr'
import { getAuthSnapshot } from '@/features/auth/authStore'
import { apiFetch } from '@/features/services/api/services.api'
import type { AppGroup, PermissionScope, PermissionType } from '@/features/admin/types/groups.types'

function getCurrentSub(): string | null {
  return getAuthSnapshot()?.username ?? null
}

export function usePermissions() {
  const sub = typeof window !== 'undefined' ? getCurrentSub() : null

  const { data: groups, error, isLoading } = useSWR<AppGroup[]>(
    sub ? `/api/v1/admin/users/${encodeURIComponent(sub)}/groups` : null,
    apiFetch
  )

  // Build flat permission set for O(1) lookups
  const permSet = new Set<string>()
  if (groups) {
    for (const g of groups) {
      for (const p of g.permissions ?? []) {
        permSet.add(`${p.scope}|${p.permission}|${p.resource}`)
      }
    }
  }

  function hasPermission(scope: PermissionScope, type: PermissionType, resource: string): boolean {
    // If no groups loaded yet → optimistic deny (safe default)
    if (!groups) return false
    return permSet.has(`${scope}|${type}|${resource}`)
  }

  /** Může uživatel vidět sloupec v daném scope? */
  function canView(scope: PermissionScope, column: string): boolean {
    return hasPermission(scope, 'view_column', column)
  }

  /** Může uživatel editovat sloupec v daném scope? */
  function canEdit(scope: PermissionScope, column: string): boolean {
    return hasPermission(scope, 'edit_column', column)
  }

  /** Může uživatel editovat ref tabulku v daném scope? */
  function canEditRef(scope: PermissionScope, refTable: string): boolean {
    return hasPermission(scope, 'edit_ref', refTable)
  }

  /** Je uživatel členem alespoň jedné skupiny s jakýmkoli oprávněním? */
  function hasAnyGroup(): boolean {
    return (groups?.length ?? 0) > 0
  }

  return {
    groups:      groups ?? [],
    isLoading,
    error,
    canView,
    canEdit,
    canEditRef,
    hasAnyGroup,
    hasPermission,
  }
}
