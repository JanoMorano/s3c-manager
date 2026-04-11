export interface CountForms {
  one: string;
  few: string;
  many: string;
}

function resolveCountForm(value: number, forms: CountForms) {
  const absolute = Math.abs(value);
  const mod10 = absolute % 10;
  const mod100 = absolute % 100;

  if (absolute === 1) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return forms.few;
  return forms.many;
}

export function formatCountLabel(value: number, forms: CountForms) {
  return `${value} ${resolveCountForm(value, forms)}`;
}

export function formatFilteredCountLabel(visible: number, total: number, forms: CountForms) {
  const normalizedTotal = visible === 0 ? 0 : total;
  return `${visible} / ${normalizedTotal} ${resolveCountForm(normalizedTotal, forms)}`;
}

export const COUNT_LABELS = {
  items: { one: 'položka', few: 'položky', many: 'položek' },
  records: { one: 'záznam', few: 'záznamy', many: 'záznamů' },
  services: { one: 'služba', few: 'služby', many: 'služeb' },
  results: { one: 'výsledek', few: 'výsledky', many: 'výsledků' },
} satisfies Record<string, CountForms>;
