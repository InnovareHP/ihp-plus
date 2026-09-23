import type { APIRoute } from 'astro'

/** Every indexable page; the site is small enough that a list beats a sitemap integration. */
const PAGES = ['/']

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('http://localhost')
  const urls = PAGES.map((path) => `  <url><loc>${new URL(path, origin).href}</loc></url>`)
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
