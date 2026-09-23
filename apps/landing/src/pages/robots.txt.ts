import type { APIRoute } from 'astro'

// The portal under /app is behind sign-in, so crawlers are kept to the marketing site.
export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('http://localhost')
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /app/',
    '',
    `Sitemap: ${new URL('/sitemap.xml', origin).href}`,
    '',
  ].join('\n')

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
