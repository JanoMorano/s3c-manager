'use client';

import { useEffect } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../../dashboard/dashboard.module.css';

export default function OwnerLoadRedirectPage() {
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
        title="Owner load moved into Operations"
        purpose="Owner load is now a panel and filter inside the Operations action queue."
        primaryAction={{ label: 'Open Operations', href: target }}
      />
      <Link href={target} className={styles.secondaryLink}>Open owner load panel</Link>
    </main>
  );
}
