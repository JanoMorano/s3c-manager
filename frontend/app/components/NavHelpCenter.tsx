'use client';

import { BookOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from '@/app/components/AppLink';
import { useI18n } from '@/app/i18n/useI18n';
import { helpIndexHref, isHelpPath } from '@/app/lib/helpRoutes';
import styles from './NavHelpCenter.module.css';

export default function NavHelpCenter() {
  const pathname = usePathname() ?? '';
  const { locale, t } = useI18n();
  const helpHref = helpIndexHref(locale);
  const isHelp = isHelpPath(pathname);

  return (
    <div className={styles.stack}>
      <Link
        href={helpHref}
        className={`${styles.helpLink} ${isHelp ? styles.helpLinkActive : ''}`}
      >
        <BookOpen size={16} />
        <span>{t('nav.help')}</span>
      </Link>
      <span className={styles.versionBadge}>v.1.2</span>
    </div>
  );
}
