import useSWR from 'swr'
import { apiFetch } from '@/features/services/api/services.api'
import type { AppGroup } from '../types/groups.types'

export function useGroups() {
  const { data, error, isLoading, mutate } = useSWR<AppGroup[]>(
    '/api/v1/admin/groups',
    apiFetch
  )
  return {
    groups:    data ?? [],
    isLoading,
    error,
    mutate,
  }
}

export function useGroup(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AppGroup>(
    id != null ? `/api/v1/admin/groups/${id}` : null,
    apiFetch
  )
  return {
    group:     data,
    isLoading,
    error,
    mutate,
  }
}
