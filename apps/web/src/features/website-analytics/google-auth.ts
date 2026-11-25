import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
// Renew a minute early so a token never expires mid-report.
const EARLY_MS = 60_000

export class GoogleAuthError extends Error {}

interface ServiceAccountKey {
  client_email: string
  private_key: string
}

let cached: { token: string; expiresAt: number } | undefined

function keyOf(): ServiceAccountKey {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!encoded) throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_KEY is not set.')
  try {
    const key = JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf8'),
    ) as Partial<ServiceAccountKey>
    if (typeof key.client_email === 'string' && typeof key.private_key === 'string') {
      return { client_email: key.client_email, private_key: key.private_key }
    }
  } catch {
    // Falls through to the same message as a key missing its fields.
  }
  throw new GoogleAuthError('GOOGLE_SERVICE_ACCOUNT_KEY is not a base64 service account key.')
}

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** A read-only Analytics token for the service account, reused until it nearly expires. */
export async function analyticsToken(now = Date.now()): Promise<string> {
  if (cached && cached.expiresAt - EARLY_MS > now) return cached.token

  const key = keyOf()
  const issuedAt = Math.floor(now / 1000)
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: key.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url')

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: unknown
    expires_in?: unknown
  }
  if (!response.ok || typeof body.access_token !== 'string') {
    throw new GoogleAuthError(`Google refused the service account (${response.status}).`)
  }

  const lifetime = typeof body.expires_in === 'number' ? body.expires_in : 3600
  cached = { token: body.access_token, expiresAt: now + lifetime * 1000 }
  return cached.token
}

/** Tests start every case signed out. */
export function forgetAnalyticsToken() {
  cached = undefined
}
