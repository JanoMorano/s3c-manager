import { normalizeLocale } from '../../../shared/i18n/core';

export function formatDate(
  locale: string | null | undefined,
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(date);
}

export function compareText(
  locale: string | null | undefined,
  left: string,
  right: string,
  options: Intl.CollatorOptions = {},
): number {
  return left.localeCompare(right, normalizeLocale(locale), {
    numeric: true,
    sensitivity: 'base',
    ...options,
  });
}
