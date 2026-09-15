import { createSign, randomUUID } from 'node:crypto'
import { requireGraphConfig, type GraphCertificate, type GraphConfig } from './config'

const SCOPE = 'https://graph.microsoft.com/.default'
/** Refresh early: a token that expires mid-flight reads as a 401 the caller cannot fix. */
const EXPIRY_SKEW_SECONDS = 120
const ASSERTION_LIFETIME_SECONDS = 10 * 60

interface CachedToken {
  key: string
  accessToken: string
  expiresAt: number
}

let cached: CachedToken | undefined
let inFlight: Promise<string> | undefined

function base64url(value: Buffer) {
  return value.toString('base64url')
}

function tokenEndpoint(tenantId: string) {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
}

/** Entra shows a thumbprint as hex; the x5t header wants those bytes base64url-encoded. */
function x5t(thumbprint: string) {
  return base64url(Buffer.from(thumbprint.replace(/[^0-9a-fA-F]/g, ''), 'hex'))
}

function clientAssertion(config: GraphConfig, certificate: GraphCertificate) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', x5t: x5t(certificate.thumbprint) }
  const payload = {
    aud: tokenEndpoint(config.tenantId),
    iss: config.clientId,
    sub: config.clientId,
    jti: randomUUID(),
    nbf: now,
    exp: now + ASSERTION_LIFETIME_SECONDS,
  }

  const signingInput = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(
    Buffer.from(JSON.stringify(payload)),
  )}`
  const signature = createSign('RSA-SHA256').update(signingInput).sign(certificate.privateKeyPem)

  return `${signingInput}.${base64url(signature)}`
}

function credentialBody(config: GraphConfig) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'client_credentials',
    scope: SCOPE,
  })

  if (config.certificate) {
    body.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
    body.set('client_assertion', clientAssertion(config, config.certificate))
  } else if (config.secret) {
    body.set('client_secret', config.secret)
  }

  return body
}

async function requestToken(config: GraphConfig) {
  const response = await fetch(tokenEndpoint(config.tenantId), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: credentialBody(config).toString(),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!response.ok || !payload.access_token) {
    const reason = payload.error_description ?? payload.error ?? `HTTP ${response.status}`
    throw new Error(`Could not get a Graph token: ${reason}`)
  }

  return { accessToken: payload.access_token, expiresIn: payload.expires_in ?? 3600 }
}

/** Identity of the credential in use, so a rotated secret invalidates the cache by itself. */
function cacheKey(config: GraphConfig) {
  return `${config.tenantId}:${config.clientId}:${config.certificate?.thumbprint ?? config.secret}`
}

export async function getAccessToken({ force = false } = {}) {
  const config = requireGraphConfig()
  const key = cacheKey(config)

  if (!force && cached && cached.key === key && cached.expiresAt > Date.now()) {
    return cached.accessToken
  }
  if (force) {
    cached = undefined
    inFlight = undefined
  }
  // One token request even when a burst of calls all find the cache cold.
  inFlight ??= requestToken(config)
    .then(({ accessToken, expiresIn }) => {
      cached = {
        key,
        accessToken,
        expiresAt: Date.now() + (expiresIn - EXPIRY_SKEW_SECONDS) * 1000,
      }
      return accessToken
    })
    .finally(() => {
      inFlight = undefined
    })

  return inFlight
}

export function resetTokenCache() {
  cached = undefined
  inFlight = undefined
}
