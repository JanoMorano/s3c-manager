'use client';

import { useEffect } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/app/i18n/useI18n';
import styles from '../../dashboard/dashboard.module.css';

export default function OwnerLoadRedirectPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const owner = searchParams?.get('owner') ?? '';
  const target = owner ? `/operations?owner=${encodeURIComponent(owner)}#owner-load` : '/operations#owner-load';

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('operations.owner_load.moved_title')}
        purpose={t('operations.owner_load.moved_purpose')}
        primaryAction={{ label: t('operations.owner_load.open_operations'), href: target }}
      />
      <Link href={target} className={styles.secondaryLink}>{t('operations.owner_load.open_panel')}</Link>
    </main>
  );
}
