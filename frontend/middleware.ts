import { NextResponse, type NextRequest } from 'next/server';
import { normalizeLegacyC3Path } from './app/lib/c3Routes';

const PROTECTED_PATH_PREFIXES = [
  '/admin',
  '/administration',
  '/import',
  '/management',
  '/services',
  '/user-info',
];

function isPublicC3ReadOnlyPath(pathname: string) {
  return (
    pathname === '/c3/list' ||
    pathname === '/c3/services' ||
    pathname === '/c3/applications' ||
    pathname === '/c3/data-objects' ||
    pathname === '/c3/technology-interactions' ||
    /^\/c3\/services\/[^/]+$/.test(pathname) ||
    /^\/c3\/applications\/[^/]+$/.test(pathname) ||
    /^\/c3\/data-objects\/[^/]+$/.test(pathname) ||
    /^\/c3\/technology-interactions\/[^/]+$/.test(pathname)
  );
}

function isProtectedPath(pathname: string) {
  if (pathname.startsWith('/c3/')) {
    return !isPublicC3ReadOnlyPath(pathname);
  }
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const normalizedPath = normalizeLegacyC3Path(request.nextUrl.pathname);
  if (normalizedPath !== request.nextUrl.pathname) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = normalizedPath;
    return NextResponse.redirect(nextUrl, 308);
  }

  if (isProtectedPath(normalizedPath)) {
    const hasAccessCookie = Boolean(
      request.cookies.get('sc_access_token')?.value ||
      request.cookies.get('sc_refresh_token')?.value,
    );
    if (!hasAccessCookie) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = '/login';
      nextUrl.searchParams.set('next', normalizedPath);
      return NextResponse.redirect(nextUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/administration/:path*',
    '/c3/:path*',
    '/c3-dashboard',
    '/import/:path*',
    '/management/:path*',
    '/services/:path*',
    '/user-info',
  ],
};
