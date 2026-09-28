import { beforeEach, describe, expect, it, vi } from 'vitest'

const redis = vi.hoisted(() => ({
  isRedisConfigured: vi.fn(),
  redisRateLimitStorage: { consume: vi.fn() },
}))

vi.mock('./redis', () => redis)

const { clientIpOf, consumeRateLimit } = await import('./rate-limit')

const RULE = { window: 60, max: 5 }

beforeEach(() => vi.clearAllMocks())

describe('consumeRateLimit', () => {
  it('lets everything through when Redis is not set up, rather than locking the public out', async () => {
    redis.isRedisConfigured.mockReturnValue(false)

    expect(await consumeRateLimit('hiring:apply:1.2.3.4', RULE)).toEqual({
      allowed: true,
      retryAfter: null,
    })
    expect(redis.redisRateLimitStorage.consume).not.toHaveBeenCalled()
  })

  it('counts against the shared Redis window when it is', async () => {
    redis.isRedisConfigured.mockReturnValue(true)
    redis.redisRateLimitStorage.consume.mockResolvedValue({ allowed: false, retryAfter: 42 })

    expect(await consumeRateLimit('hiring:apply:1.2.3.4', RULE)).toEqual({
      allowed: false,
      retryAfter: 42,
    })
    expect(redis.redisRateLimitStorage.consume).toHaveBeenCalledWith('hiring:apply:1.2.3.4', RULE)
  })
})

describe('clientIpOf', () => {
  it('takes the left-most forwarded address, which is the client', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.2' })
    expect(clientIpOf(headers)).toBe('203.0.113.9')
  })

  it('still yields a key when nothing was forwarded', () => {
    expect(clientIpOf(new Headers())).toBe('unknown')
  })
})
