import { type Locale } from './messages';

export const BOOTSTRAP_LOCALE_GLOBAL = '__SC_BOOTSTRAP_LOCALE__';

export function getLocaleBootstrapScript(): string {
  return `
(function() {
  function normalizeLocale(value) {
    if (typeof value !== 'string') return 'cs';
    var trimmed = value.trim().toLowerCase().replace(/_/g, '-');
    if (!trimmed) return 'cs';
    var base = trimmed.split('-')[0];
    if (base === 'cs' || base === 'cz' || base === 'cze') return 'cs';
    if (base === 'en') return 'en';
    return 'cs';
  }

  try {
    var raw = window.sessionStorage.getItem('sc_auth_snapshot');
    if (!raw) return;

    var snapshot = JSON.parse(raw);
    var preferred = snapshot && typeof snapshot.preferred_lang === 'string' ? snapshot.preferred_lang : '';
    if (!preferred) return;

    var locale = normalizeLocale(preferred);
    window.${BOOTSTRAP_LOCALE_GLOBAL} = locale;
    document.documentElement.lang = locale;
    document.cookie = 'sc_locale=' + encodeURIComponent(locale) + '; Path=/; Max-Age=31536000; SameSite=Lax';
  } catch (error) {
    // Ignore malformed bootstrap state and continue with server-resolved locale.
  }
})();
  `.trim();
}

export function readBootstrapLocale(): Locale | null {
  if (typeof window === 'undefined') return null;

  const locale = (window as Window & { __SC_BOOTSTRAP_LOCALE__?: string }).__SC_BOOTSTRAP_LOCALE__;
  return locale === 'cs' || locale === 'en' ? locale : null;
}
