const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Checks a Cloudflare Turnstile token; an unset secret skips it so local dev needs no account. */
export async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.warn('[turnstile] TURNSTILE_SECRET_KEY is unset, so the check was skipped')
    return true
  }
  if (!token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (ip !== 'unknown') body.set('remoteip', ip)
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    })
    const result = (await response.json()) as { success?: boolean }
    return result.success === true
  } catch (error) {
    console.error('[turnstile] siteverify failed', error instanceof Error ? error.message : error)
    return false
  }
}
