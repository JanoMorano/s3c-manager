import type { HelpPage } from './types';

export function normalizeHelpSlug(slug: string[] | undefined) {
  if (!slug || slug.length === 0) return 'index';
  if (slug.length > 1) return null;

  const [segment] = slug;
  if (!segment || segment === 'index' || segment === 'index.html') return 'index';
  return segment.endsWith('.html') ? segment.slice(0, -5) : segment;
}

export function findHelpPage(pages: HelpPage[], slug: string[] | undefined) {
  const key = normalizeHelpSlug(slug);
  return pages.find((item) => item.key === key) ?? null;
}

export function generateHelpStaticParams(pages: HelpPage[]) {
  return [
    { slug: [] },
    ...pages
      .filter((page) => page.key !== 'index')
      .map((page) => ({ slug: [page.key] })),
  ];
}
