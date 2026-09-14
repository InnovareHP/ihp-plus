import { createClient } from 'redis'

export interface RateLimitRule {
  window: number
  max: number
}

export interface RateLimitDecision {
  allowed: boolean
  /** Seconds until the window resets; null when the request is allowed. */
  retryAfter: number | null
}

export function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL)
}

async function openClient() {
  const client = createClient({ url: process.env.REDIS_URL })
  client.on('error', (error: unknown) => {
    console.error('[redis]', error instanceof Error ? error.message : error)
  })
  await client.connect()
  return client
}

type RedisClient = Awaited<ReturnType<typeof openClient>>

// Next's dev server re-evaluates this module on every edit, so the connection is cached the way the Prisma client is.
const globalForRedis = globalThis as unknown as { ihpRedis?: Promise<RedisClient> }

function connection(): Promise<RedisClient> {
  const pending =
    globalForRedis.ihpRedis ??
    openClient().catch((error: unknown) => {
      // A failed connect is not cached, so the next request tries again instead of failing forever.
      globalForRedis.ihpRedis = undefined
      throw error
    })
  globalForRedis.ihpRedis = pending
  return pending
}

/** Better Auth's rate-limit store, so a limit holds across every web instance, not per process. */
export const redisRateLimitStorage = {
  async consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    try {
      const client = await connection()
      const counter = `ratelimit:${key}`
      const count = await client.incr(counter)
      // The window opens on the first attempt, so its expiry is set once rather than on every hit.
      if (count === 1) await client.expire(counter, rule.window)
      if (count <= rule.max) return { allowed: true, retryAfter: null }

      const ttl = await client.ttl(counter)
      return { allowed: false, retryAfter: ttl > 0 ? ttl : rule.window }
    } catch (error) {
      // Fails open: a Redis outage must not lock everyone out of signing in.
      console.error('[redis] rate limit check failed, so the request was allowed', error)
      return { allowed: true, retryAfter: null }
    }
  },
}
