'use client';

import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import styles from './NavHelpCenter.module.css';

export default function NavHelpCenter() {
  const t = useT();

  return (
    <div className={styles.stack}>
      <span className={styles.versionBadge}>v.1.1.2</span>
      <Link href="/help" className={styles.trigger}>
        {t('nav.help')}
      </Link>
    </div>
  );
}
