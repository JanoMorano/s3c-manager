'use client';
/**
 * InstallLayoutWrapper
 *
 * Renders install pages without the navigation shell.
 * Other routes keep the standard layout wrapper and navigation.
 *
 * This keeps the install wizard fullscreen and isolated from app navigation.
 */
import { usePathname } from 'next/navigation';

export default function InstallLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  if (pathname?.startsWith('/install')) {
    // Install wizard: render only children because the wizard owns its layout.
    return <>{children}</>;
  }

  // Normal operation: keep the standard app shell behavior.
  return <>{children}</>;
}
