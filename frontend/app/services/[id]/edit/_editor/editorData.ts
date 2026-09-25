import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import useSWR from 'swr';

// Editor data is loaded once per service and refreshed explicitly after saves,
// so background revalidation never replaces what the user is editing.
const EDITOR_SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  shouldRetryOnError: false,
};

const EMPTY: never[] = [];

/**
 * A list loaded for the editor. `reload` refetches it, `replace` stores a save
 * response without refetching. A failed load leaves the list empty.
 */
export function useEditorList<T>(key: string | null, fetcher: () => Promise<T[]>) {
  const { data, error, mutate } = useSWR<T[]>(key, fetcher, EDITOR_SWR_OPTIONS);
  const reload = useCallback(async () => { await mutate(); }, [mutate]);
  const replace = useCallback(async (items: T[]) => { await mutate(items, { revalidate: false }); }, [mutate]);
  return { items: data ?? (EMPTY as T[]), error: error as unknown, reload, replace };
}

/** Local edits of a server list; a newly loaded or saved server list replaces the edits. */
export function useDraftList<T>(serverItems: T[]): [T[], Dispatch<SetStateAction<T[]>>] {
  const [draft, setDraft] = useState<{ source: T[]; items: T[] } | null>(null);
  const items = draft && draft.source === serverItems ? draft.items : serverItems;
  const setItems = useCallback<Dispatch<SetStateAction<T[]>>>((action) => {
    setDraft((previous) => {
      const base = previous && previous.source === serverItems ? previous.items : serverItems;
      return { source: serverItems, items: typeof action === 'function' ? (action as (items: T[]) => T[])(base) : action };
    });
  }, [serverItems]);
  return [items, setItems];
}
