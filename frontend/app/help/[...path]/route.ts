import { type NextRequest } from 'next/server';
import { resolveHelpRedirectPath } from '../helpRedirect';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { path = [] } = await params;

  return new Response(null, {
    status: 307,
    headers: { Location: resolveHelpRedirectPath(request, path) },
  });
}
