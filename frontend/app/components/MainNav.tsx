'use client';

import Link from '@/app/components/AppLink';
import { usePathname } from 'next/navigation';
import { useInstallStatus } from '@/features/install/installStatus';
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

  return (
    <div className={styles.navLeft}>
      <NavPill href="/catalogue" label="Catalogue" active={pathname === '/catalogue' || pathname.startsWith('/services')} />
      {c3Visible && (
        <>
          <NavPill href="/capabilities" label="Capabilities" active={pathname.startsWith('/capabilities')} />
          <NavPill href="/spirals" label="Spirals" active={pathname.startsWith('/spirals')} />
          <NavPill href={C3_ROUTES.list} label="Frameworks" active={pathname === C3_ROUTES.list} />
        </>
      )}
      <NavPill href="/operations" label="Operations" active={pathname.startsWith('/operations')} />
      <NavPill href="/administration" label="Administration" active={pathname.startsWith('/administration')} />
    </div>
  );
}
