import { isRedisConfigured, redisRateLimitStorage, type RateLimitRule } from './redis'

/**
 * Throttles a session-free form by a key the caller builds (an IP, an email). It shares Better
 * Auth's Redis counter and fails open the same way, so an outage never locks the public out.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule) {
  if (!isRedisConfigured()) return { allowed: true, retryAfter: null }
  return redisRateLimitStorage.consume(key, rule)
}

/** The nginx proxy is the first hop, so the client's own address is the left-most entry. */
export function clientIpOf(headers: Headers) {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
