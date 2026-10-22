import { describe, expect, it } from 'vitest';
import { schema } from './schema';

const base = { title: 'Service', service_type: 'ES' };

describe('service editor schema — SLA numbers', () => {
  it('treats an emptied number input as no value, not 0', () => {
    const parsed = schema.parse({ ...base, sla_availability: '', sla_restoration: '', sla_delivery: '' });
    expect(parsed.sla_availability).toBeNull();
    expect(parsed.sla_restoration).toBeNull();
    expect(parsed.sla_delivery).toBeNull();
  });

  it('coerces numeric strings and keeps the range check', () => {
    expect(schema.parse({ ...base, sla_availability: '99.9' }).sla_availability).toBe(99.9);
    expect(schema.safeParse({ ...base, sla_availability: '101' }).success).toBe(false);
    expect(schema.safeParse({ ...base, sla_restoration: '-1' }).success).toBe(false);
  });

  it('leaves untouched fields untouched', () => {
    const parsed = schema.parse(base);
    expect(parsed.sla_availability).toBeUndefined();
  });
});
