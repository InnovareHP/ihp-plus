import { absoluteUrl } from '@ihp/email'
import { withBasePath } from '@/lib/routes'

/** An absolute portal URL for an email, origin and basePath included. */
export function portalUrl(route: string) {
  return absoluteUrl(withBasePath(route))
}
