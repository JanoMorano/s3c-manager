'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '../layout.module.css';

export default function NavGlobalSearch() {
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
    <form className={styles.navSearchForm} onSubmit={handleSubmit} role="search" aria-label="Global search">
      <input
        className={styles.navSearchInput}
        type="search"
        placeholder="Search všude…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search everywhere"
      />
      <button type="submit" className={styles.navSearchButton}>
        Search
      </button>
    </form>
  );
}
