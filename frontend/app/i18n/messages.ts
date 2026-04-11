import { DEFAULT_LOCALE, normalizeLocale } from '../../../shared/i18n/core';
import { getCatalog as getSharedCatalog, translate as translateShared } from '../../../shared/i18n/catalog';

import type csCatalog from '../../../shared/i18n/messages/cs.json';

export type Locale = 'cs' | 'en';
export type MessageCatalog = typeof csCatalog;
export type MessageKey = keyof MessageCatalog;
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

export function getCatalog(locale?: string | null): MessageCatalog {
  return getSharedCatalog(normalizeLocale(locale)) as MessageCatalog;
}

export function t(locale: string | null | undefined, key: MessageKey | string, params?: TranslationParams): string {
  return translateShared(normalizeLocale(locale), key, params);
}
