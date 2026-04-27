import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import './globals.css';
import AppShell from './components/AppShell';
import I18nProvider from './i18n/I18nProvider';
import { PersonaProvider } from '@/features/auth/PersonaContext';
import { ThemeProvider } from '@/features/theme/ThemeContext';
import { getLocaleBootstrapScript } from './i18n/bootstrap';
import { resolveLocaleFromHeader } from '../../shared/i18n/locales';
import { normalizeSupportedLocale } from '../../shared/i18n/core';

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
  const cookieLocale = normalizeSupportedLocale(cookieStore.get('sc_locale')?.value);
  const headerLocale = headerStore.get('accept-language');
  const resolvedLocale = cookieLocale ?? resolveLocaleFromHeader(headerLocale);
  const themeBootstrap = `
    (function(){
      try {
        var mode = localStorage.getItem('s3c_theme_mode') || 'system';
        var theme = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
      } catch (_) {}
    })();
  `;

  return (
    <html lang={resolvedLocale}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: getLocaleBootstrapScript() }} />
      </head>
      <body>
        <I18nProvider initialLocale={resolvedLocale}>
          <ThemeProvider>
            <PersonaProvider>
              <AppShell>{children}</AppShell>
            </PersonaProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
