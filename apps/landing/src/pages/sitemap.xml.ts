import type { APIRoute } from 'astro'
import { SERVICES, servicePath } from '../data/services'

/** Every indexable page; the site is small enough that a list beats a sitemap integration. */
const PAGES = ['/', ...SERVICES.map((service) => servicePath(service.slug))]

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://www.ihpplusglobal.com')
  // The build date: every deploy is a static rebuild, so it is when the pages last changed.
  const lastmod = new Date().toISOString().slice(0, 10)
  const urls = PAGES.map(
    (path) => `  <url><loc>${new URL(path, origin).href}</loc><lastmod>${lastmod}</lastmod></url>`,
  )
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
