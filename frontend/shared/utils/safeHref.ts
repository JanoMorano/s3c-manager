export function safeHref(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return raw;
    }
  } catch {
    return null;
  }

  return null;
}
