'use client';

import Link from '@/app/components/AppLink';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { COUNT_LABELS, formatCountLabel } from '../lib/counts';
import styles from './search.module.css';

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

  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  const { data, isLoading, error } = useSWR<GlobalSearchResponse>(
    queryParam.trim() ? `/api/v1/search/global?q=${encodeURIComponent(queryParam.trim())}` : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = query.trim();
    router.push(next ? `/search?query=${encodeURIComponent(next)}` : '/search');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Global Search</div>
          <h1 className={styles.title}>Search všude</h1>
          <p className={styles.subtitle}>
            Hledání přes Service Catalogue, C3 Taxonomy, C3 Services, Applications, Data Objects, Technology Interactions
            a pro adminy i `C3 Capability Builder`.
          </p>
        </div>
      </div>

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
          Zadej hledaný výraz nahoře. Kódy jako `APL-2`, `SRV-10`, `TIN-196` nebo názvy fungují nejlépe.
        </div>
      )}

      {queryParam.trim() && (
        <div className={styles.resultsWrap}>
          <div className={styles.summary}>
            {isLoading ? 'Načítám…' : error ? 'Hledání selhalo.' : `${formatCountLabel(data?.total ?? 0, COUNT_LABELS.results)} pro „${queryParam}“`}
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
