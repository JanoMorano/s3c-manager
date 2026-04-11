import { compareText, formatDate } from '@/app/i18n/format';

export interface CapabilityParentItem {
  uuid: string;
  external_id: string | null;
  title: string;
  item_type?: string | null;
}

export function sortCapabilityParentItems(
  locale: string,
  items: CapabilityParentItem[],
  currentUuid: string,
): CapabilityParentItem[] {
  return [...items]
    .filter((entry) => entry.uuid !== currentUuid)
    .sort((left, right) => compareText(locale, `${left.external_id ?? left.title}`, `${right.external_id ?? right.title}`, { numeric: true, sensitivity: 'base' }));
}

export function formatCapabilityTimestamp(locale: string, value: string | null) {
  if (!value) return '—';
  return formatDate(locale, value, { dateStyle: 'medium', timeStyle: 'short' });
}
