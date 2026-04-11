import type { Metadata } from 'next';
import './globals.css';
import AppShell from './components/AppShell';

export const metadata: Metadata = {
  title: 'Service Catalogue v2',
  description: 'Internal service catalogue — graph + pricing + SLA + taxonomy',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
