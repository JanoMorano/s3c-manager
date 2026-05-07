import { type NextRequest } from 'next/server';
import { resolveHelpRedirectPath } from './helpRedirect';

export function GET(request: NextRequest) {
  return new Response(null, {
    status: 307,
    headers: { Location: resolveHelpRedirectPath(request) },
  });
}
