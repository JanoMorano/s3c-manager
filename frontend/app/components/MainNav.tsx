'use client';

import Link from '@/app/components/AppLink';
import { usePathname } from 'next/navigation';
import { useInstallStatus } from '@/features/install/installStatus';
import { useT } from '@/app/i18n/useI18n';
import styles from '../layout.module.css';
import { C3_ROUTES } from '../lib/c3Routes';

function NavPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link prefetch={false} href={href} className={`${styles.navDropdownTrigger} ${active ? styles.navDropdownTriggerActive : ''}`}>
      {label}
    </Link>
  );
}

export default function MainNav() {
  const pathname = usePathname() ?? '';
  const { c3Visible } = useInstallStatus();
  const t = useT();

  return (
    <div className={styles.navLeft}>
      <NavPill href="/catalogue" label={t('nav.topbar.segment.catalogue')} active={pathname === '/catalogue' || pathname.startsWith('/services')} />
      {c3Visible && (
        <>
          <NavPill href="/capabilities" label={t('nav.topbar.segment.capabilities')} active={pathname.startsWith('/capabilities')} />
          <NavPill href="/spirals" label={t('nav.topbar.segment.spirals')} active={pathname.startsWith('/spirals')} />
          <NavPill href={C3_ROUTES.list} label={t('nav.main_nav.frameworks')} active={pathname === C3_ROUTES.list} />
        </>
      )}
      <NavPill href="/operations" label={t('nav.main_nav.operations')} active={pathname.startsWith('/operations')} />
      <NavPill href="/administration" label={t('nav.administration')} active={pathname.startsWith('/administration')} />
    </div>
  );
}
