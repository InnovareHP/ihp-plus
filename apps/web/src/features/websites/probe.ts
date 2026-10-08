import { lookup } from 'node:dns/promises'
import { isPrivateAddress, type ProbeReading } from './utils/verdict'

const TIMEOUT_MS = 15_000
// A redirect could hop to an internal host, so each hop is resolved and checked like the first.
const MAX_REDIRECTS = 5

async function resolvesPublic(hostname: string) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  const addresses = await lookup(hostname, { all: true })
  return addresses.length > 0 && addresses.every((entry) => !isPrivateAddress(entry.address))
}

/** Opens the site the way a visitor would and reports what came back and how fast. */
export async function probeWebsite(url: string): Promise<ProbeReading> {
  const started = performance.now()
  let target = new URL(url)

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await resolvesPublic(target.hostname))) {
        return { httpStatus: undefined, responseMs: undefined, error: 'Address is not public' }
      }

      const response = await fetch(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'IHP+ website check' },
        cache: 'no-store',
      })
      // The body is not needed and an unread one keeps the socket open.
      await response.body?.cancel()

      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        target = new URL(location, target)
        continue
      }

      return {
        httpStatus: response.status,
        responseMs: Math.round(performance.now() - started),
        error: '',
      }
    }
    return { httpStatus: undefined, responseMs: undefined, error: 'Too many redirects' }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return {
      httpStatus: undefined,
      responseMs: undefined,
      error: timedOut ? `No answer within ${TIMEOUT_MS / 1000} s` : 'Could not reach the site',
    }
  }
}
