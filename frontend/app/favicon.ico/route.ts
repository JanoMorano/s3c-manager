const FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f172a"/>
  <path d="M18 10h28v9H27v8h16v9H27v9h21v9H18z" fill="#f8fafc"/>
</svg>
`.trim();

export function GET() {
  return new Response(FAVICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
