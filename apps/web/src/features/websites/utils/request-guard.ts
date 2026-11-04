// Video, audio and long-lived streams add nothing to a still picture and only slow the page down.
const SKIPPED_TYPES = new Set(['media', 'websocket', 'eventsource', 'ping'])

// Inline content never leaves the browser, so there is no host to vet.
const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:'])

/**
 * Whether the snapshot browser may fetch one request. A page pulls in scripts, images and fetches
 * from anywhere, and each one could aim at our own network, so every host is vetted like the probe's.
 */
export async function requestAllowed(
  rawUrl: string,
  resourceType: string,
  isPublicHost: (hostname: string) => Promise<boolean>,
): Promise<boolean> {
  if (SKIPPED_TYPES.has(resourceType)) return false

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (LOCAL_SCHEMES.has(url.protocol)) return true
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  try {
    return await isPublicHost(url.hostname.replace(/^\[|\]$/g, ''))
  } catch {
    return false
  }
}
