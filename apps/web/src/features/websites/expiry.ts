import { connect } from 'node:tls'
import { resolvesPublic } from './probe'
import { registrableDomain } from './utils/domain'

const TIMEOUT_MS = 8_000

export interface Expiry {
  /** ISO date the domain registration runs out, when the registry publishes it. */
  domain: string | undefined
  /** ISO date the site's https certificate stops being valid. */
  ssl: string | undefined
}

interface RdapEvent {
  eventAction?: unknown
  eventDate?: unknown
}

// IANA's own list of which registry answers RDAP for each ending; rdap.org's shortcut refuses servers.
const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json'
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000
const HEADERS = { accept: 'application/rdap+json', 'user-agent': 'IHP+ website check' }

let bootstrap: { loadedAt: number; bases: Map<string, string> } | undefined

async function registryFor(domain: string): Promise<string | undefined> {
  if (!bootstrap || Date.now() - bootstrap.loadedAt > BOOTSTRAP_TTL_MS) {
    const response = await fetch(BOOTSTRAP_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': HEADERS['user-agent'] },
    })
    if (!response.ok) return undefined
    const body = (await response.json()) as { services?: [string[], string[]][] }
    const bases = new Map<string, string>()
    for (const [endings, urls] of body.services ?? []) {
      const base = urls.find((url) => url.startsWith('https://')) ?? urls[0]
      if (base) for (const ending of endings) bases.set(ending.toLowerCase(), base)
    }
    bootstrap = { loadedAt: Date.now(), bases }
  }
  const ending = domain.split('.').pop() ?? ''
  return bootstrap.bases.get(ending)
}

async function domainExpiresAt(url: string): Promise<string | undefined> {
  const domain = registrableDomain(url)
  if (!domain) return undefined
  try {
    const base = await registryFor(domain)
    if (!base) return undefined
    const response = await fetch(
      `${base.replace(/\/?$/, '/')}domain/${encodeURIComponent(domain)}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: HEADERS,
        cache: 'no-store',
      },
    )
    if (!response.ok) return undefined
    const body = (await response.json()) as { events?: RdapEvent[] }
    const expiration = body.events?.find((event) => event.eventAction === 'expiration')
    if (typeof expiration?.eventDate !== 'string') return undefined
    const at = new Date(expiration.eventDate)
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString()
  } catch {
    return undefined
  }
}

/** Lets a test start from an empty registry list. */
export function forgetRegistries() {
  bootstrap = undefined
}

async function sslExpiresAt(url: string): Promise<string | undefined> {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return undefined
  }
  if (target.protocol !== 'https:') return undefined
  // Same guard as the probe: the lookup runs inside our network and must not reach back into it.
  if (!(await resolvesPublic(target.hostname).catch(() => false))) return undefined

  return new Promise((resolve) => {
    const socket = connect({
      host: target.hostname,
      port: Number(target.port) || 443,
      servername: target.hostname,
      // An expired or mismatched certificate is exactly what this reads, so it must not abort the handshake.
      rejectUnauthorized: false,
    })
    const finish = (value: string | undefined) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(TIMEOUT_MS, () => finish(undefined))
    socket.once('error', () => finish(undefined))
    socket.once('secureConnect', () => {
      const validTo = socket.getPeerCertificate().valid_to
      const at = validTo ? new Date(validTo) : undefined
      finish(at && !Number.isNaN(at.getTime()) ? at.toISOString() : undefined)
    })
  })
}

/** Both dates for one site; either is left out rather than failing when it cannot be read. */
export async function expiryOf(url: string): Promise<Expiry> {
  const [domain, ssl] = await Promise.all([domainExpiresAt(url), sslExpiresAt(url)])
  return { domain, ssl }
}
