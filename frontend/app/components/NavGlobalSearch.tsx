'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useT } from '@/app/i18n/useI18n';
import { authHeaders } from '@/features/services/api/services.api';
import styles from '../layout.module.css';

interface PaletteItem {
  code: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

interface PaletteResponse {
  groups: Record<string, PaletteItem[]>;
  total: number;
}

const PALETTE_GROUPS = [
  ['services', 'Services'],
  ['capabilities', 'Capabilities'],
  ['frameworks', 'Frameworks'],
] as const;

export default function NavGlobalSearch() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams?.get('query') ?? '');
  const [palette, setPalette] = useState<PaletteResponse | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (pathname === '/search') {
      setQuery(searchParams?.get('query') ?? '');
    }
  }, [pathname, searchParams]);

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
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(next)}&type=any&limit=4`, {
          credentials: 'include',
          signal: controller.signal,
          headers: authHeaders(),
        });
        const json = await response.json().catch(() => null);
        if (response.ok) setPalette(json as PaletteResponse);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    setPaletteOpen(false);
    router.push(next ? `/search?query=${encodeURIComponent(next)}` : '/search');
  }

  function goTo(href: string) {
    setPaletteOpen(false);
    router.push(href);
  }

  return (
    <div className={styles.navSearchWrap}>
      <form className={styles.navSearchForm} onSubmit={handleSubmit} role="search" aria-label={t('nav.global_search_aria')}>
        <Search className={styles.navSearchIcon} size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.navSearchInput}
          type="search"
          placeholder="Search services, capabilities, decisions..."
          value={query}
          onFocus={() => setPaletteOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setPaletteOpen(true);
          }}
          aria-label={t('nav.global_search_aria')}
        />
        <kbd className={styles.navSearchKbd}>⌘K</kbd>
        <button type="submit" className={styles.navSearchSubmit}>
          {t('nav.global_search_submit')}
        </button>
      </form>
      {paletteOpen && query.trim().length >= 2 && (
        <div className={styles.commandPalette} role="dialog" aria-label="Command palette search results">
          {paletteBusy && <div className={styles.commandState}>Searching…</div>}
          {!paletteBusy && palette && palette.total === 0 && <div className={styles.commandState}>No results. Press Enter for full search.</div>}
          {!paletteBusy && palette && palette.total > 0 && PALETTE_GROUPS.map(([key, label]) => {
            const items = palette.groups?.[key] ?? [];
            if (!items.length) return null;
            return (
              <section key={key} className={styles.commandGroup}>
                <h3>{label}</h3>
                {items.map((item) => (
                  <button key={`${key}-${item.code}-${item.href}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(item.href)}>
                    <code>{item.code}</code>
                    <span>{item.title}</span>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </button>
                ))}
              </section>
            );
          })}
          <button type="button" className={styles.commandFooter} onMouseDown={(event) => event.preventDefault()} onClick={() => handleSubmit({ preventDefault: () => undefined } as FormEvent<HTMLFormElement>)}>
            Open full search for “{query.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
