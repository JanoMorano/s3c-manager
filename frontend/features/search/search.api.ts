import { authHeaders } from '@/features/services/api/services.api';
import type { GlobalSearchResponse } from './search.types';

type SearchEndpoint = 'global' | 'suggest';

interface FetchGlobalSearchOptions {
  endpoint?: SearchEndpoint;
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchGlobalSearch(query: string, options: FetchGlobalSearchOptions = {}): Promise<GlobalSearchResponse> {
  const endpoint = options.endpoint ?? 'global';
  const params = new URLSearchParams();
  params.set('q', query.trim());
  params.set('limit', String(options.limit ?? 10));

  const response = await fetch(`/api/v1/search/${endpoint}?${params.toString()}`, {
    credentials: 'include',
    signal: options.signal,
    headers: authHeaders(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `Search request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as GlobalSearchResponse;
}
