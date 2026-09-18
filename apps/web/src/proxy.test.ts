import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from './proxy'

const mocks = vi.hoisted(() => ({ getSessionCookie: vi.fn() }))

vi.mock('better-auth/cookies', () => ({ getSessionCookie: mocks.getSessionCookie }))

// nextUrl.pathname excludes basePath, and NextURL puts it back when it serialises.
function request(path: string) {
  return new NextRequest(new URL(`/app${path === '/' ? '' : path}`, 'http://localhost:3000'), {
    nextConfig: { basePath: '/app' },
  })
}

describe('proxy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends an anonymous visitor to the login page and remembers where they were going', () => {
    mocks.getSessionCookie.mockReturnValue(null)

    const response = proxy(request('/settings'))

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location') ?? '')
    expect(location.pathname).toBe('/app/login')
    expect(location.searchParams.get('next')).toBe('/settings')
  })

  it('guards the dashboard at the root path', () => {
    mocks.getSessionCookie.mockReturnValue(null)

    const location = new URL(proxy(request('/')).headers.get('location') ?? '')

    expect(location.pathname).toBe('/app/login')
    expect(location.searchParams.get('next')).toBe('/')
  })

  it('lets an anonymous visitor reach the public routes', () => {
    mocks.getSessionCookie.mockReturnValue(null)

    for (const path of ['/login', '/verify-email', '/forgot-password', '/reset-password']) {
      expect(proxy(request(path)).headers.get('location')).toBeNull()
    }
  })

  it('bounces a signed-in user off the public routes', () => {
    mocks.getSessionCookie.mockReturnValue('a-session-token')

    const location = new URL(proxy(request('/login')).headers.get('location') ?? '')

    expect(location.pathname).toBe('/app')
    expect(location.search).toBe('')
  })

  it('passes a signed-in user through to a protected route', () => {
    mocks.getSessionCookie.mockReturnValue('a-session-token')

    expect(proxy(request('/settings')).headers.get('location')).toBeNull()
  })
})
