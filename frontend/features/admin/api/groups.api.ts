import { authHeaders } from '@/features/services/api/services.api'
import type { AppGroup, GroupPermission } from '../types/groups.types'

const BASE = '/api/v1/admin'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function listGroups(): Promise<AppGroup[]> {
  const res = await fetch(`${BASE}/groups`, { headers: authHeaders() })
  return handleResponse<AppGroup[]>(res)
}

export async function getGroup(id: number): Promise<AppGroup> {
  const res = await fetch(`${BASE}/groups/${id}`, { headers: authHeaders() })
  return handleResponse<AppGroup>(res)
}

export async function createGroup(data: {
  group_code: string
  group_name: string
  description?: string
}): Promise<AppGroup> {
  const res = await fetch(`${BASE}/groups`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<AppGroup>(res)
}

export async function updateGroup(
  id: number,
  data: { group_name: string; description?: string | null; is_active: boolean }
): Promise<AppGroup> {
  const res = await fetch(`${BASE}/groups/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<AppGroup>(res)
}

export async function deleteGroup(id: number): Promise<void> {
  const res = await fetch(`${BASE}/groups/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  await handleResponse<unknown>(res)
}

export async function setGroupPermissions(
  id: number,
  permissions: GroupPermission[]
): Promise<void> {
  const res = await fetch(`${BASE}/groups/${id}/permissions`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  })
  await handleResponse<unknown>(res)
}

export async function addGroupMember(
  groupId: number,
  userSub: string
): Promise<void> {
  const res = await fetch(`${BASE}/groups/${groupId}/members`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_sub: userSub }),
  })
  await handleResponse<unknown>(res)
}

export async function removeGroupMember(
  groupId: number,
  userSub: string
): Promise<void> {
  const res = await fetch(`${BASE}/groups/${groupId}/members/${encodeURIComponent(userSub)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  await handleResponse<unknown>(res)
}

export async function getUserGroups(sub: string): Promise<AppGroup[]> {
  const res = await fetch(`${BASE}/users/${encodeURIComponent(sub)}/groups`, {
    headers: authHeaders(),
  })
  return handleResponse<AppGroup[]>(res)
}
