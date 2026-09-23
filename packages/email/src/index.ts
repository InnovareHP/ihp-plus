export { isEmailConfigured, sendEmail, type OutboundEmail } from './send'
export * from './templates'
export { renderEmail, type EmailLayout } from './layout'

/** An absolute URL for a path the caller already prefixed, such as the web app's basePath. */
export function absoluteUrl(path: string) {
  const origin = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  return `${origin}${path}`
}
