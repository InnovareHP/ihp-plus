import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/** What the server needs between chunks; the browser only ever holds it sealed. */
export interface UploadSession {
  uploadUrl: string
  userId: string
  /** Library path of the folder the file lands in. */
  path: string
  size: number
  expiresAt: number
}

// Long enough for a slow connection to finish a large file, short of Graph's own session expiry.
export const UPLOAD_SESSION_MS = 6 * 60 * 60 * 1000

function key() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set, so an upload cannot be sealed.')
  // A label keeps this key distinct from every other use of the same secret.
  return createHash('sha256').update(`library-upload:${secret}`).digest()
}

/** Encrypted, not just signed: Graph's upload URL is pre-authenticated and must stay server-side. */
export function sealUploadSession(session: UploadSession) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

/** Undefined for a token that was altered, sealed with another secret, or has run out. */
export function openUploadSession(token: string, now = Date.now()): UploadSession | undefined {
  try {
    const raw = Buffer.from(token, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString(
      'utf8',
    )
    const session = JSON.parse(json) as UploadSession
    return session.expiresAt > now ? session : undefined
  } catch {
    return undefined
  }
}
