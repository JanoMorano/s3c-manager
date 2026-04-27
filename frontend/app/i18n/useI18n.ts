'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE } from '../../../shared/i18n/core';
import { t as translate, type Locale, type MessageKey, type TranslationParams } from './messages';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey | string, params?: TranslationParams) => string;
}

const defaultContext: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key) => key,
};

export const I18nContext = createContext<I18nContextValue>(defaultContext);

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function useLocale(): Locale {
  return useI18n().locale;
}

export function useT(): I18nContextValue['t'] {
  return useI18n().t;
}

export function translateWithLocale(locale: Locale, key: MessageKey | string, params?: TranslationParams): string {
  return translate(locale, key, params);
}
