import { normalizeSupportedLocale } from '../../../shared/i18n/core';
import { resolveLocaleFromHeader } from '../../../shared/i18n/locales';
import type { NextRequest } from 'next/server';

export function helpBaseForLocale(locale: string) {
  return locale === 'en' ? '/help-en' : '/help-cs';
}

export function resolveHelpBase(request: NextRequest) {
  const cookieLocale = normalizeSupportedLocale(request.cookies.get('sc_locale')?.value);
  const locale = cookieLocale ?? resolveLocaleFromHeader(request.headers.get('accept-language'));

  return helpBaseForLocale(locale);
}

export function resolveHelpRedirectPath(request: NextRequest, pathSegments: string[] = []) {
  const helpBase = resolveHelpBase(request);
  const safePath = pathSegments
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return safePath ? `${helpBase}/${safePath}` : helpBase;
}
