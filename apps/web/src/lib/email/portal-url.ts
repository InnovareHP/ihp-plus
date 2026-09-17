import { withBasePath } from '@/lib/routes'

/** An absolute portal URL for an email, origin and basePath included. */
export function portalUrl(route: string) {
  const origin = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  return `${origin}${withBasePath(route)}`
}
