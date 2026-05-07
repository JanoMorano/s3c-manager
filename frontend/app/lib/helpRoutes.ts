export function helpRootForLocale(locale: string | null | undefined) {
  return locale === 'en' ? '/help-en' : '/help-cs';
}

export function helpIndexHref(locale: string | null | undefined) {
  return helpRootForLocale(locale);
}

export function isHelpPath(pathname: string) {
  return (
    pathname === '/help' ||
    pathname.startsWith('/help/') ||
    pathname === '/help-cs' ||
    pathname.startsWith('/help-cs/') ||
    pathname === '/help-en' ||
    pathname.startsWith('/help-en/')
  );
}
