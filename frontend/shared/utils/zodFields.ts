import { z } from 'zod';

/**
 * Optional numeric form field. An emptied number input submits '' which
 * z.coerce.number() would turn into 0; treat it as "no value" instead.
 */
export function optionalNumber(min: number, max?: number) {
  const base = z.coerce.number().min(min);
  return z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    (max === undefined ? base : base.max(max)).nullable(),
  ).optional();
}
