import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

const mocks = vi.hoisted(() => ({ handler: vi.fn() }))

vi.mock('@/lib/auth', () => ({ auth: { handler: mocks.handler } }))

describe('auth route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handler.mockResolvedValue(new Response(null, { status: 200 }))
  })

  it('puts back the basePath Next strips before the handler sees the URL', async () => {
    await GET(new Request('http://localhost:3000/api/auth/get-session'))

    const received = mocks.handler.mock.calls[0]?.[0] as Request
    expect(new URL(received.url).pathname).toBe('/app/api/auth/get-session')
  })

  it('keeps the query string, which carries the OAuth state', async () => {
    await GET(new Request('http://localhost:3000/api/auth/callback/microsoft?code=abc&state=xyz'))

    const url = new URL((mocks.handler.mock.calls[0]?.[0] as Request).url)
    expect(url.pathname).toBe('/app/api/auth/callback/microsoft')
    expect(url.searchParams.get('state')).toBe('xyz')
  })

  it('forwards a POST body and method untouched', async () => {
    await POST(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ada@innovarehp.com', password: 'correct-horse-battery' }),
      }),
    )

    const received = mocks.handler.mock.calls[0]?.[0] as Request
    expect(received.method).toBe('POST')
    await expect(received.json()).resolves.toEqual({
      email: 'ada@innovarehp.com',
      password: 'correct-horse-battery',
    })
  })

  it('leaves an already-prefixed path alone', async () => {
    await GET(new Request('http://localhost:3000/app/api/auth/get-session'))

    const received = mocks.handler.mock.calls[0]?.[0] as Request
    expect(new URL(received.url).pathname).toBe('/app/api/auth/get-session')
  })
})
