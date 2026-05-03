'use client';
/**
 * AppShell — conditional layout wrapper.
 *
 * /install  → fullscreen without navigation or auth guard (install wizard owns its shell).
 * /login    → fullscreen without navigation, but still guarded by install readiness.
 * other     → sidebar shell: left sidebar (brand + nav + user) + right column (topbar + page).
 */
import { usePathname } from 'next/navigation';
import Link from '@/app/components/AppLink';
import styles from '../layout.module.css';
import AuthGuard from './AuthGuard';
import SidebarNav from './SidebarNav';
import NavUser from './NavUser';
import NavHelpCenter from './NavHelpCenter';
import TopBar from './TopBar';

// ── Brand mark SVG ─────────────────────────────────────────────────────────
function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect width="20" height="20" rx="5" fill="currentColor"/>
      <rect x="4" y="4" width="5" height="5" rx="1" fill="white" opacity=".9"/>
      <rect x="11" y="4" width="5" height="5" rx="1" fill="white" opacity=".6"/>
      <rect x="4" y="11" width="5" height="5" rx="1" fill="white" opacity=".6"/>
      <rect x="11" y="11" width="5" height="5" rx="1" fill="white" opacity=".3"/>
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  // Install wizard must always remain reachable, even before auth exists.
  if (pathname.startsWith('/install')) {
    return <>{children}</>;
  }

  // Login has no app shell, but it still needs install readiness routing.
  if (pathname.startsWith('/login')) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <>
      {/* Skip navigation for keyboard users */}
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>

      <div className={styles.appShell}>

        {/* ── Left sidebar ────────────────────────────────────────────── */}
        <aside className={styles.sidebar} aria-label="Main navigation">

          {/* Brand */}
          <div className={styles.sidebarBrand}>
            <Link href="/" className={styles.sidebarBrandLink} aria-label="Service Catalogue home">
              <span className={styles.sidebarBrandMark}>
                <BrandMark />
              </span>
              <span className={styles.sidebarBrandName}>S3C Manager</span>
            </Link>
          </div>

          {/* Navigation items */}
          <div className={styles.sidebarBody}>
            <SidebarNav />
          </div>

          {/* User */}
          <div className={styles.sidebarBottom}>
            <NavHelpCenter />
            <NavUser />
          </div>

        </aside>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className={styles.pageColumn}>

          <TopBar />

          {/* Page content */}
          <main id="main-content" className={styles.pageContent}>
            <AuthGuard>{children}</AuthGuard>
          </main>

        </div>
      </div>
    </>
  );
}
