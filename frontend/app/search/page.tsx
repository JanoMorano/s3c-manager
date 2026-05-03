'use client';

import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { KbdChip } from '@/app/components/layout-v2';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { COUNT_LABELS, formatCountLabel } from '../lib/counts';
import styles from './search.module.css';

const RECENT_KEY = 'sc_recent_searches';
const SAVED_KEY = 'sc_saved_searches';
const RECENT_MAX = 10;
const SAVED_MAX = 20;

interface SavedSearch {
  id: string;
  label: string;
  query: string;
  createdAt: string;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  try {
    const prev = loadRecent().filter((s) => s !== term);
    localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...prev].slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

function loadSaved(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedSearch[]) : [];
  } catch {
    return [];
  }
}

function persistSaved(items: SavedSearch[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, SAVED_MAX)));
  } catch {
    /* ignore */
  }
}

interface SearchItem {
  source_key: string;
  code: string;
  title: string;
  description: string | null;
  subtitle: string | null;
  status: string | null;
  href: string;
}

interface SearchGroup {
  key: string;
  label: string;
  items: SearchItem[];
}

interface GlobalSearchResponse {
  query: string;
  total: number;
  groups: SearchGroup[];
}

export default function GlobalSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams?.get('query') ?? '';
  const [query, setQuery] = useState(queryParam);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    setRecentSearches(loadRecent());
    setSavedSearches(loadSaved());
  }, []);

  // Save to recent when a real search completes
  useEffect(() => {
    if (queryParam.trim()) {
      saveRecent(queryParam.trim());
      setRecentSearches(loadRecent());
    }
  }, [queryParam]);

  const { data, isLoading, error } = useSWR<GlobalSearchResponse>(
    queryParam.trim() ? `/api/v1/search/global?q=${encodeURIComponent(queryParam.trim())}` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = query.trim();
    router.push(next ? `/search?query=${encodeURIComponent(next)}` : '/search');
  }, [query, router]);

  const fillRecent = useCallback((term: string) => {
    router.push(`/search?query=${encodeURIComponent(term)}`);
  }, [router]);

  const clearRecent = useCallback(() => {
    try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
    setRecentSearches([]);
  }, []);

  const saveCurrentSearch = useCallback(() => {
    const term = queryParam.trim();
    if (!term) return;
    const next: SavedSearch = {
      id: `${Date.now()}-${term}`,
      label: term,
      query: term,
      createdAt: new Date().toISOString(),
    };
    const saved = [next, ...loadSaved().filter((item) => item.query !== term)];
    persistSaved(saved);
    setSavedSearches(saved.slice(0, SAVED_MAX));
  }, [queryParam]);

  const deleteSavedSearch = useCallback((id: string) => {
    const next = loadSaved().filter((item) => item.id !== id);
    persistSaved(next);
    setSavedSearches(next);
  }, []);

  const openSavedSearch = useCallback((term: string) => {
    router.push(`/search?query=${encodeURIComponent(term)}`);
  }, [router]);

  const isCurrentSaved = savedSearches.some((item) => item.query === queryParam.trim());

  return (
    <div className={styles.page}>
      <PageHeader
        title="Search"
        purpose="Jedno místo pro služby, capabilities, C3 entity a administrační záznamy."
        chips={[{ label: queryParam ? `${queryParam}` : 'Ready', tone: queryParam ? 'info' : 'neutral' }]}
        primaryAction={{ label: 'Catalogue', href: '/catalogue' }}
      />

      <form className={styles.searchBar} onSubmit={handleSubmit}>
        <input
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Např. APL-2, SRV-10, BP-1000, Air..."
        />
        <button type="submit" className={styles.searchButton}>
          Search
        </button>
      </form>

      {!queryParam.trim() && (
        <div className={styles.emptyState}>
          <p>Zadej kód, název nebo zkratku. Nejrychlejší je otevřít search přes <KbdChip>⌘K</KbdChip>.</p>
          {recentSearches.length > 0 && (
            <div className={styles.recentSection}>
              <div className={styles.recentHeader}>
                <span className={styles.recentLabel}>Nedávná hledání</span>
                <button type="button" className={styles.recentClear} onClick={clearRecent}>
                  Smazat
                </button>
              </div>
              <div className={styles.recentChips}>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className={styles.recentChip}
                    onClick={() => fillRecent(term)}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          {savedSearches.length > 0 && (
            <div className={styles.savedSection}>
              <div className={styles.recentHeader}>
                <span className={styles.recentLabel}>Saved searches</span>
              </div>
              <div className={styles.savedList}>
                {savedSearches.map((item) => (
                  <div key={item.id} className={styles.savedRow}>
                    <button type="button" className={styles.savedOpen} onClick={() => openSavedSearch(item.query)}>
                      <span>Star</span>
                      <strong>{item.label}</strong>
                    </button>
                    <button type="button" className={styles.savedDelete} onClick={() => deleteSavedSearch(item.id)}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {queryParam.trim() && (
        <div className={styles.resultsWrap}>
          <div className={styles.summary}>
            {isLoading ? 'Načítám…' : error ? 'Hledání selhalo.' : `${formatCountLabel(data?.total ?? 0, COUNT_LABELS.results)} pro „${queryParam}“`}
            <button
              type="button"
              className={styles.saveSearchButton}
              onClick={saveCurrentSearch}
              disabled={isCurrentSaved}
            >
              {isCurrentSaved ? 'Saved search' : 'Save search'}
            </button>
          </div>

          {error && <div className={styles.error}>{error.message}</div>}

          {!isLoading && !error && data && data.groups.length === 0 && (
            <div className={styles.emptyState}>Nic jsem nenašel.</div>
          )}

          {data?.groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <div className={styles.groupHeader}>
                <h2 className={styles.groupTitle}>{group.label}</h2>
                <span className={styles.groupCount}>{group.items.length}</span>
              </div>
              <div className={styles.groupList}>
                {group.items.map((item) => (
                  <Link key={`${group.key}-${item.code}-${item.href}`} href={item.href} className={styles.resultCard}>
                    <div className={styles.resultTop}>
                      <code className={styles.code}>{item.code}</code>
                      {item.status ? <span className={styles.status}>{item.status}</span> : null}
                    </div>
                    <div className={styles.resultTitle}>{item.title}</div>
                    {item.subtitle ? <div className={styles.resultMeta}>{item.subtitle}</div> : null}
                    {item.description ? <div className={styles.resultDescription}>{item.description}</div> : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
