import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  on: vi.fn(),
  connect: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}))

const redis = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('redis', () => redis)

const { redisRateLimitStorage } = await import('./redis')

const RULE = { window: 60, max: 5 }

describe('redisRateLimitStorage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // The connection is cached on globalThis, so each test starts from a fresh one.
    delete (globalThis as { ihpRedis?: unknown }).ihpRedis
    redis.createClient.mockReturnValue(client)
    client.connect.mockResolvedValue(undefined)
    client.expire.mockResolvedValue(1)
  })

  it('opens the window on the first attempt and allows it', async () => {
    client.incr.mockResolvedValue(1)

    expect(await redisRateLimitStorage.consume('203.0.113.7/sign-in/email', RULE)).toEqual({
      allowed: true,
      retryAfter: null,
    })
    expect(client.incr).toHaveBeenCalledWith('ratelimit:203.0.113.7/sign-in/email')
    expect(client.expire).toHaveBeenCalledWith('ratelimit:203.0.113.7/sign-in/email', 60)
  })

  it('does not stretch the window on later attempts', async () => {
    client.incr.mockResolvedValue(3)

    await redisRateLimitStorage.consume('key', RULE)

    expect(client.expire).not.toHaveBeenCalled()
  })

  it('refuses past the limit and says how long until the window resets', async () => {
    client.incr.mockResolvedValue(6)
    client.ttl.mockResolvedValue(42)

    expect(await redisRateLimitStorage.consume('key', RULE)).toEqual({
      allowed: false,
      retryAfter: 42,
    })
  })

  it('allows the request when Redis is unreachable, rather than locking everyone out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    client.connect.mockRejectedValue(new Error('ECONNREFUSED'))

    expect(await redisRateLimitStorage.consume('key', RULE)).toEqual({
      allowed: true,
      retryAfter: null,
    })
  })

  it('tries to connect again after a failed connection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    client.connect.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(undefined)
    client.incr.mockResolvedValue(1)

    await redisRateLimitStorage.consume('key', RULE)
    await redisRateLimitStorage.consume('key', RULE)

    expect(client.connect).toHaveBeenCalledTimes(2)
    expect(client.incr).toHaveBeenCalledTimes(1)
  })
})
