'use client';

import Link from '@/app/components/AppLink';
import { useEffect } from 'react';
import styles from '../../graph/overview.module.css';
import { C3_ROUTES } from '../../lib/c3Routes';

export default function C3GraphError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('C3 graph route error', error);
  }, [error]);

  return (
    <div className={styles.stateError} style={{ display: 'grid', gap: '1rem', maxWidth: '48rem' }}>
      <div>
        C3 graph se nepodařilo vykreslit. Stránka spadla do lokální error boundary, takže nepadne celý web.
      </div>
      <div style={{ fontSize: '0.92rem', opacity: 0.9 }}>
        Zkus zúžit výběr přes L1/L3 capability nebo stránku načíst znovu.
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={styles.saveButtonInline}
          onClick={() => reset()}
        >
          Zkusit znovu
        </button>
        <Link href="/c3/list" className={styles.typeBtn} style={{ textDecoration: 'none' }}>
          Otevřít C3 Taxonomy
        </Link>
        <Link href={C3_ROUTES.capabilityMapSpiral7} className={styles.typeBtn} style={{ textDecoration: 'none' }}>
          Otevřít Capability Map
        </Link>
      </div>
      {error?.digest ? (
        <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
          Error digest: {error.digest}
        </div>
      ) : null}
    </div>
  );
}
