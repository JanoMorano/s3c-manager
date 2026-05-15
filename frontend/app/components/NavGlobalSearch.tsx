'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useT } from '@/app/i18n/useI18n';
import { fetchGlobalSearch } from '@/features/search/search.api';
import type { GlobalSearchGroup, GlobalSearchResponse } from '@/features/search/search.types';
import styles from '../layout.module.css';

export default function NavGlobalSearch() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams?.get('query') ?? '');
  const [palette, setPalette] = useState<GlobalSearchResponse | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- U5: global search mirrors the /search query when that route is active. */
  useEffect(() => {
    if (pathname === '/search') {
      setQuery(searchParams?.get('query') ?? '');
    }
  }, [pathname, searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- U5: palette state is intentionally synchronized with debounced query/network results. */
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const next = query.trim();
    if (next.length < 2 || !paletteOpen) {
      setPalette(null);
      setPaletteBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPaletteBusy(true);
      try {
        setPalette(await fetchGlobalSearch(next, { endpoint: 'suggest', limit: 4, signal: controller.signal }));
      } catch {
        if (!controller.signal.aborted) setPalette(null);
      } finally {
        if (!controller.signal.aborted) setPaletteBusy(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [paletteOpen, query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openSearchPage();
  }

  function openSearchPage() {
    const next = query.trim();
    setPaletteOpen(false);
    router.push(next ? `/search?query=${encodeURIComponent(next)}` : '/search');
  }

  function goTo(href: string) {
    setPaletteOpen(false);
    router.push(href);
  }

  function groupHeading(group: GlobalSearchGroup) {
    if (group.kind === 'help') return 'Help';
    if (group.module_label && group.module_label !== group.label) return `${group.module_label} - ${group.label}`;
    return group.label;
  }

  return (
    <div className={styles.navSearchWrap}>
      <form className={styles.navSearchForm} onSubmit={handleSubmit} role="search" aria-label={t('nav.global_search_aria')}>
        <Search className={styles.navSearchIcon} size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.navSearchInput}
          type="search"
          placeholder="Search any word across the application..."
          value={query}
          onFocus={() => setPaletteOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setPaletteOpen(true);
          }}
          aria-label={t('nav.global_search_aria')}
        />
        <kbd className={styles.navSearchKbd}>Ctrl K</kbd>
        <button type="submit" className={styles.navSearchSubmit}>
          {t('nav.global_search_submit')}
        </button>
      </form>
      {paletteOpen && query.trim().length >= 2 && (
        <div className={styles.commandPalette} role="dialog" aria-label="Global search suggestions">
          {paletteBusy && <div className={styles.commandState}>Searching...</div>}
          {!paletteBusy && palette && palette.total === 0 && <div className={styles.commandState}>{t('nav.global_search_no_results_service_list')}</div>}
          {!paletteBusy && palette && palette.total > 0 && palette.groups.map((group) => (
            <section key={group.key} className={styles.commandGroup}>
              <h3>{groupHeading(group)}</h3>
              {(group.items ?? []).map((item) => (
                <button key={`${group.key}-${item.code}-${item.href}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(item.href)}>
                  <code>{item.code}</code>
                  <span>{item.title}</span>
                  {item.subtitle && <small>{item.subtitle}</small>}
                </button>
              ))}
            </section>
          ))}
          <button type="button" className={styles.commandFooter} onMouseDown={(event) => event.preventDefault()} onClick={openSearchPage}>
            Open grouped results for "{query.trim()}"
          </button>
        </div>
      )}
    </div>
  );
}
