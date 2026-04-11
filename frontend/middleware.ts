import { NextResponse, type NextRequest } from 'next/server';
import { normalizeLegacyC3Path } from './app/lib/c3Routes';

export function middleware(request: NextRequest) {
  const normalizedPath = normalizeLegacyC3Path(request.nextUrl.pathname);
  if (normalizedPath !== request.nextUrl.pathname) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = normalizedPath;
    return NextResponse.redirect(nextUrl, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/c3/:path*',
    '/admin/c3-application/:path*',
    '/admin/c3-data-objects/:path*',
    '/admin/c3-services/:path*',
    '/admin/c3-technology-interactions/:path*',
    '/c3-dashboard',
    '/c3/capability-map',
    '/admin/c3/:slug',
  ],
};
