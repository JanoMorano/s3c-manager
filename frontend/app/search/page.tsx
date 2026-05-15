import { Suspense } from 'react';
import SearchPageClient from './SearchPageClient';
import styles from './search.module.css';

export default function SearchPage() {
  return (
    <Suspense
      fallback={(
        <main className={styles.page}>
          <div className={styles.emptyState}>Loading search...</div>
        </main>
      )}
    >
      <SearchPageClient />
    </Suspense>
  );
}
