'use client';
/**
 * AppShell: conditional layout wrapper.
 *
 * /install -> fullscreen without navigation because the install wizard owns its shell.
 * other routes -> standard app shell with top navigation and auth guard.
 */
import { usePathname } from 'next/navigation';
import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import styles from '../layout.module.css';
import AuthGuard from './AuthGuard';
import NavRight from './NavRight';
import MainNav from './MainNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname() ?? '';

  // Install wizard: render only the page without the nav shell.
  if (pathname?.startsWith('/install')) {
    return <>{children}</>;
  }

  // Standard app layout.
  return (
    <>
      {/* Skip navigation for keyboard users (§10 Accessibility) */}
      <a href="#main-content" className={styles.skipLink}>{t('shell.skip_to_content')}</a>
      <div className={styles.appShell}>
        <nav className={styles.topNav} aria-label="Main navigation">
          <Link href="/" className={styles.brand} aria-label="Service Catalogue v2 — home">SC v2</Link>

          {/* ── Left group — topic dropdowns ─────────────────────────── */}
          <MainNav />

          {/* ── Spacer ────────────────────────────────────────────────── */}
          <div className={styles.navSpacer} />

          {/* ── Right group — role-based admin links + user button ────── */}
          <div className={styles.navRight}>
            <NavRight />
          </div>
        </nav>

        <main id="main-content" className={styles.pageContent}>
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </>
  );
}
