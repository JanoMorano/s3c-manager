import { expect, test } from '@playwright/test';
import { formatDate } from '../app/i18n/format';
import { formatCapabilityTimestamp, sortCapabilityParentItems } from '../features/c3/locale-utils';

const items = [
  { uuid: 'hra-uuid', external_id: null, title: 'hra' },
  { uuid: 'chata-uuid', external_id: null, title: 'chata' },
  { uuid: 'demo-uuid', external_id: 'DEMO-001', title: 'Demo capability' },
];

test('c3 detail helpers use locale-aware sorting and formatting', () => {
  const englishOrder = sortCapabilityParentItems('en', items, 'demo-uuid').map((item) => item.title);
  const czechOrder = sortCapabilityParentItems('cs', items, 'demo-uuid').map((item) => item.title);

  expect(englishOrder.slice(0, 2)).toEqual(['chata', 'hra']);
  expect(czechOrder.slice(0, 2)).toEqual(['hra', 'chata']);

  const timestamp = '2024-04-11T12:34:56Z';
  expect(formatCapabilityTimestamp('en', timestamp)).toContain('Apr 11, 2024');
  expect(formatCapabilityTimestamp('cs', timestamp)).toContain('11. 4. 2024');
  expect(formatDate('en', timestamp, { dateStyle: 'medium', timeZone: 'UTC' })).toContain('Apr 11, 2024');
});
