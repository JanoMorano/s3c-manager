import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import './globals.css';
import AppShell from './components/AppShell';
import I18nProvider from './i18n/I18nProvider';
import { getLocaleBootstrapScript } from './i18n/bootstrap';
import { normalizeLocale, resolveLocaleFromHeader } from '../../shared/i18n/locales';

export const metadata: Metadata = {
  title: 'Service Catalogue v2',
  description: 'Internal service catalogue — graph + pricing + SLA + taxonomy',
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get('sc_locale')?.value;
  const headerLocale = headerStore.get('accept-language');
  const resolvedLocale = cookieLocale ? normalizeLocale(cookieLocale) : resolveLocaleFromHeader(headerLocale);

  return (
    <html lang={resolvedLocale}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getLocaleBootstrapScript() }} />
      </head>
      <body>
        <I18nProvider initialLocale={resolvedLocale}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
