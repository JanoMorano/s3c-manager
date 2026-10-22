import type { NextConfig } from 'next';
import packageJson from './package.json';

const nextConfig: NextConfig = {
  output: 'standalone',

  // Shown in the sidebar; follows the release version in package.json.
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },

  // API proxy: /api/* -> local middleware inside the app container.
  // Applies to server-side execution (SSR, Route Handlers).
  // The client calls relative /api/* paths; nginx or Next.js rewrites them.
  async rewrites() {
    const middlewareUrl = process.env.MIDDLEWARE_URL ?? 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${middlewareUrl}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${middlewareUrl}/api/health/ready`,
      },
    ];
  },
};

export default nextConfig;
