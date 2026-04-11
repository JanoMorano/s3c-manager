'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/app/i18n/useI18n';
import styles from '../layout.module.css';

export default function NavGlobalSearch() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams?.get('query') ?? '');

  useEffect(() => {
    if (pathname === '/search') {
      setQuery(searchParams?.get('query') ?? '');
    }
  }, [pathname, searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    router.push(next ? `/search?query=${encodeURIComponent(next)}` : '/search');
  }

  return (
    <form className={styles.navSearchForm} onSubmit={handleSubmit} role="search" aria-label={t('nav.global_search_aria')}>
      <input
        className={styles.navSearchInput}
        type="search"
        placeholder={t('nav.global_search_placeholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={t('nav.global_search_aria')}
      />
      <button type="submit" className={styles.navSearchButton}>
        {t('nav.global_search_submit')}
      </button>
    </form>
  );
}
