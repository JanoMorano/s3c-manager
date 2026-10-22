import { z } from 'zod';

/**
 * Optional numeric form field. An emptied number input submits '' which
 * z.coerce.number() would turn into 0; treat it as "no value" instead.
 */
export function optionalNumber(min: number, max?: number) {
  // Messages are i18n keys; the form field translates them.
  const base = z.coerce.number({ message: 'common.validation.number' }).min(min, 'common.validation.number_min');
  return z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    (max === undefined ? base : base.max(max, 'common.validation.number_max')).nullable(),
  ).optional();
}
