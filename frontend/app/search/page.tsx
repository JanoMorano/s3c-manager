'use client';

import { Suspense } from 'react';
import { useT } from '@/app/i18n/useI18n';
import SearchPageClient from './SearchPageClient';
import styles from './search.module.css';

export default function SearchPage() {
  const t = useT();
  return (
    <Suspense
      fallback={(
        <main className={styles.page}>
          <div className={styles.emptyState}>{t('search.loading')}</div>
        </main>
      )}
    >
      <SearchPageClient />
    </Suspense>
  );
}
