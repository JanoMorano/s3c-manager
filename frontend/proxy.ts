import { NextResponse, type NextRequest } from 'next/server';
import { normalizeLegacyC3Path } from './app/lib/c3Routes';

const JWT_ISSUER = 'service-catalogue';
const JWT_AUDIENCE = 'service-catalogue-ui';

const PROTECTED_PATH_PREFIXES = [
  '/',
  '/admin',
  '/administration',
  '/catalogue',
  '/capabilities',
  '/c3',
  '/import',
  '/management',
  '/operations',
  '/portfolio',
  '/spirals',
  '/services',
  '/user-info',
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function signHs256(input: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function isValidSessionToken(token: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)) {
  const secret = process.env.JWT_SECRET?.trim();
  if (!token || !secret) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) return false;

    const header = safeJsonParse<{ alg?: string; typ?: string }>(
      new TextDecoder().decode(base64UrlToBytes(parts[0])),
    );
    if (header?.alg !== 'HS256') return false;

    const payload = safeJsonParse<{
      aud?: string | string[];
      exp?: number;
      iss?: string;
      nbf?: number;
      sub?: string | number;
    }>(new TextDecoder().decode(base64UrlToBytes(parts[1])));
    if (!payload?.sub || payload.iss !== JWT_ISSUER || !payload.exp) return false;

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(JWT_AUDIENCE)) return false;
    if (payload.exp <= nowSeconds) return false;
    if (payload.nbf && payload.nbf > nowSeconds) return false;

    const expectedSignature = await signHs256(`${parts[0]}.${parts[1]}`, secret);
    return expectedSignature === parts[2];
  } catch {
    return false;
  }
}

function legacySearchRedirect(request: NextRequest) {
  const nextUrl = request.nextUrl.clone();
  const term = nextUrl.searchParams.get('query')
    ?? nextUrl.searchParams.get('q')
    ?? nextUrl.searchParams.get('search');
  nextUrl.pathname = '/services/list';
  nextUrl.search = '';
  if (term?.trim()) nextUrl.searchParams.set('search', term.trim());
  return NextResponse.redirect(nextUrl, 307);
}

function loginRedirect(request: NextRequest, normalizedPath: string) {
  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = '/login';
  nextUrl.searchParams.set('next', normalizedPath);
  const response = NextResponse.redirect(nextUrl);
  response.cookies.delete('sc_access_token');
  response.cookies.delete('sc_refresh_token');
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/search') {
    return legacySearchRedirect(request);
  }

  const normalizedPath = normalizeLegacyC3Path(request.nextUrl.pathname);
  if (normalizedPath !== request.nextUrl.pathname) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = normalizedPath;
    return NextResponse.redirect(nextUrl, 308);
  }

  if (isProtectedPath(normalizedPath)) {
    const hasValidSessionToken = await isValidSessionToken(
      request.cookies.get('sc_access_token')?.value,
    ) || await isValidSessionToken(
      request.cookies.get('sc_refresh_token')?.value,
    );
    if (!hasValidSessionToken) {
      return loginRedirect(request, normalizedPath);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/administration/:path*',
    '/catalogue/:path*',
    '/capabilities/:path*',
    '/c3/:path*',
    '/c3-dashboard',
    '/import/:path*',
    '/management/:path*',
    '/operations/:path*',
    '/portfolio/:path*',
    '/search',
    '/spirals/:path*',
    '/services/:path*',
    '/user-info',
  ],
};
