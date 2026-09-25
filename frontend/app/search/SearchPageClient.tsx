'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Search, Star, Trash2 } from 'lucide-react';
import { fetchGlobalSearch } from '@/features/search/search.api';
import type { GlobalSearchGroup, GlobalSearchResponse } from '@/features/search/search.types';
import styles from './search.module.css';

const RECENT_KEY = 's3c.globalSearch.recent';
const SAVED_KEY = 's3c.globalSearch.saved';

// Recent and saved searches live in localStorage, read through a small
// external store so server and first client render agree (empty lists).
const NO_ITEMS: string[] = [];
const storedListCache = new Map<string, { raw: string | null; value: string[] }>();
const storedListListeners = new Set<() => void>();

function readStoredList(key: string): string[] {
  if (typeof window === 'undefined') return NO_ITEMS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return NO_ITEMS;
  }
  const cached = storedListCache.get(key);
  if (cached && cached.raw === raw) return cached.value;
  let value = NO_ITEMS;
  try {
    const parsed = JSON.parse(raw ?? '[]');
    value = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : NO_ITEMS;
  } catch {
    value = NO_ITEMS;
  }
  storedListCache.set(key, { raw, value });
  return value;
}

function writeStoredList(key: string, values: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Storage unavailable: the list just is not remembered.
  }
  storedListListeners.forEach((listener) => listener());
}

function subscribeStoredLists(listener: () => void) {
  storedListListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    storedListListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function useStoredList(key: string): string[] {
  return useSyncExternalStore(subscribeStoredLists, () => readStoredList(key), () => NO_ITEMS);
}

interface QueryResult {
  query: string;
  payload: GlobalSearchResponse | null;
  error: string | null;
}

function groupHeading(group: GlobalSearchGroup) {
  if (group.kind === 'help') return 'Help';
  if (group.module_label && group.module_label !== group.label) return `${group.module_label} - ${group.label}`;
  return group.label;
}

export default function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams?.get('query') ?? '';
  const [input, setInput] = useState(urlQuery);
  const [searchResult, setSearchResult] = useState<QueryResult | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<QueryResult | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const recent = useStoredList(RECENT_KEY);
  const saved = useStoredList(SAVED_KEY);

  // Follow the URL query into the input (e.g. back/forward navigation).
  const [inputUrlQuery, setInputUrlQuery] = useState(urlQuery);
  if (inputUrlQuery !== urlQuery) {
    setInputUrlQuery(urlQuery);
    setInput(urlQuery);
  }

  // Results belong to the query they were loaded for; busy until they match.
  const activeQuery = urlQuery.trim();
  const currentSearch = searchResult?.query === activeQuery ? searchResult : null;
  const results = currentSearch?.payload ?? null;
  const error = currentSearch?.error ?? null;
  const busy = activeQuery.length >= 2 && !currentSearch;

  useEffect(() => {
    const query = urlQuery.trim();
    if (query.length < 2) return;

    const controller = new AbortController();
    fetchGlobalSearch(query, { endpoint: 'global', limit: 12, signal: controller.signal })
      .then((payload) => {
        setSearchResult({ query, payload, error: null });
        const nextRecent = [query, ...readStoredList(RECENT_KEY).filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8);
        writeStoredList(RECENT_KEY, nextRecent);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setSearchResult({ query, payload: null, error: err instanceof Error ? err.message : 'Search failed' });
        }
      });

    return () => controller.abort();
  }, [urlQuery]);

  const suggestionQuery = input.trim();
  const currentSuggestions = suggestionResult?.query === suggestionQuery ? suggestionResult : null;
  const suggestions = currentSuggestions?.payload ?? null;
  const suggestionsBusy = suggestionQuery.length >= 2 && suggestionQuery !== activeQuery && !currentSuggestions;

  useEffect(() => {
    const query = input.trim();
    if (query.length < 2 || query === urlQuery.trim()) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchGlobalSearch(query, { endpoint: 'suggest', limit: 5, signal: controller.signal })
        .then((payload) => setSuggestionResult({ query, payload, error: null }))
        .catch(() => {
          if (!controller.signal.aborted) setSuggestionResult({ query, payload: null, error: null });
        });
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [input, urlQuery]);

  const hasQuery = urlQuery.trim().length >= 2;
  const showSuggestions = suggestionsOpen && input.trim().length >= 2 && input.trim() !== urlQuery.trim();
  const savedCurrent = useMemo(
    () => saved.some((item) => item.toLowerCase() === urlQuery.trim().toLowerCase()),
    [saved, urlQuery],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openInputQuery();
  }

  function openInputQuery() {
    const next = input.trim();
    setSuggestionsOpen(false);
    router.push(next ? `/search?query=${encodeURIComponent(next)}` : '/search');
  }

  function openQuery(query: string) {
    setInput(query);
    setSuggestionsOpen(false);
    router.push(`/search?query=${encodeURIComponent(query)}`);
  }

  function openResult(href: string) {
    setSuggestionsOpen(false);
    router.push(href);
  }

  function saveSearch() {
    const query = urlQuery.trim();
    if (!query || savedCurrent) return;
    writeStoredList(SAVED_KEY, [query, ...saved].slice(0, 12));
  }

  function deleteSaved(query: string) {
    writeStoredList(SAVED_KEY, saved.filter((item) => item !== query));
  }

  function clearRecent() {
    writeStoredList(RECENT_KEY, []);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Global search</div>
          <h1 className={styles.title}>Search across S3C Manager</h1>
          <p className={styles.subtitle}>
            Every word is matched across services, C3, management records, application pages and help content.
          </p>
        </div>
      </header>

      <form className={styles.searchBar} onSubmit={submitSearch} role="search">
        <input
          className={styles.searchInput}
          type="search"
          value={input}
          onFocus={() => setSuggestionsOpen(true)}
          onChange={(event) => {
            setInput(event.target.value);
            setSuggestionsOpen(true);
          }}
          placeholder="Search any word across services, C3, management, pages or help..."
          aria-label="Global search query"
        />
        <button className={styles.searchButton} type="submit">
          <Search size={16} aria-hidden="true" />
          Search
        </button>
      </form>

      {showSuggestions && (
        <section className={styles.suggestions} aria-label="Search suggestions">
          {suggestionsBusy && <div className={styles.suggestionState}>Searching all modules...</div>}
          {!suggestionsBusy && suggestions && suggestions.total === 0 && (
            <div className={styles.suggestionState}>No live matches yet.</div>
          )}
          {!suggestionsBusy && suggestions && suggestions.total > 0 && suggestions.groups.map((group) => (
            <div key={group.key} className={styles.suggestionGroup}>
              <div className={styles.suggestionGroupTitle}>{groupHeading(group)}</div>
              <div className={styles.suggestionItems}>
                {group.items.map((item) => (
                  <button
                    key={`${group.key}-${item.code}-${item.href}`}
                    type="button"
                    className={styles.suggestionItem}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openResult(item.href)}
                  >
                    <code>{item.code}</code>
                    <span>{item.title}</span>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className={styles.suggestionFooter}
            onMouseDown={(event) => event.preventDefault()}
            onClick={openInputQuery}
          >
            Open all grouped results for “{input.trim()}”
          </button>
        </section>
      )}

      {!hasQuery && (
        <section className={styles.emptyState}>
          <p>Enter at least two characters. Multi-word queries are split into words and matched across the full application index.</p>
          {recent.length > 0 && (
            <div className={styles.recentSection}>
              <div className={styles.recentHeader}>
                <span className={styles.recentLabel}>Recent searches</span>
                <button type="button" className={styles.recentClear} onClick={clearRecent}>Clear</button>
              </div>
              <div className={styles.recentChips}>
                {recent.map((query) => (
                  <button key={query} type="button" className={styles.recentChip} onClick={() => openQuery(query)}>
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}
          {saved.length > 0 && (
            <div className={styles.savedSection}>
              <div className={styles.recentLabel}>Saved searches</div>
              <div className={styles.savedList}>
                {saved.map((query) => (
                  <div key={query} className={styles.savedRow}>
                    <button type="button" className={styles.savedOpen} onClick={() => openQuery(query)}>
                      <Star size={14} aria-hidden="true" />
                      <strong>{query}</strong>
                    </button>
                    <button type="button" className={styles.savedDelete} onClick={() => deleteSaved(query)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {hasQuery && (
        <section className={styles.resultsWrap} aria-live="polite">
          <div className={styles.summary}>
            <span>
              {busy ? 'Searching...' : `${results?.total ?? 0} results for "${urlQuery.trim()}"`}
            </span>
            <button type="button" className={styles.saveSearchButton} onClick={saveSearch} disabled={savedCurrent || !urlQuery.trim()}>
              {savedCurrent ? 'Saved' : 'Save search'}
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {!busy && !error && results && results.total === 0 && (
            <div className={styles.emptyState}>No results found in modules or help.</div>
          )}
          {!error && results?.groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <div className={styles.groupHeader}>
                <h2 className={styles.groupTitle}>{groupHeading(group)}</h2>
                <span className={styles.groupCount}>{group.items.length} items</span>
              </div>
              <div className={styles.groupList}>
                {group.items.map((item) => (
                  <Link key={`${group.key}-${item.code}-${item.href}`} href={item.href} className={styles.resultCard}>
                    <div className={styles.resultTop}>
                      <code className={styles.code}>{item.code}</code>
                      {item.status && <span className={styles.status}>{item.status}</span>}
                    </div>
                    <strong className={styles.resultTitle}>{item.title}</strong>
                    {item.subtitle && <span className={styles.resultMeta}>{item.subtitle}</span>}
                    {item.description && <p className={styles.resultDescription}>{item.description}</p>}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
    </main>
  );
}
