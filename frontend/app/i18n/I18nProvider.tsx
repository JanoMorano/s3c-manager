'use client';

import { useEffect, useState } from 'react';
import { AUTH_STATE_EVENT, getAuthSnapshot } from '@/features/auth/authStore';
import { normalizeLocale } from '../../../shared/i18n/core';
import { readBootstrapLocale } from './bootstrap';
import { I18nContext } from './useI18n';
import { t as translate, type Locale } from './messages';

function persistLocaleCookie(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `sc_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function syncDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  persistLocaleCookie(locale);
}

export default function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: string;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(() => {
    const bootstrapLocale = readBootstrapLocale();
    if (bootstrapLocale) return bootstrapLocale;

    const snapshotLocale = getAuthSnapshot()?.preferred_lang;
    return normalizeLocale(snapshotLocale ?? initialLocale) as Locale;
  });

  useEffect(() => {
    const syncFromSnapshot = () => {
      const preferredLang = getAuthSnapshot()?.preferred_lang;
      if (!preferredLang) return;

      const nextLocale = normalizeLocale(preferredLang) as Locale;
      setLocale((current) => (current === nextLocale ? current : nextLocale));
    };

    syncFromSnapshot();
    window.addEventListener(AUTH_STATE_EVENT, syncFromSnapshot);
    return () => window.removeEventListener(AUTH_STATE_EVENT, syncFromSnapshot);
  }, []);

  useEffect(() => {
    syncDocumentLocale(locale);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t: (key, params) => translate(locale, key, params) }}>
      {children}
    </I18nContext.Provider>
  );
}
