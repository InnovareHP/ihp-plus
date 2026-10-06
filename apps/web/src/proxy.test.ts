import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { config, proxy } from './proxy'

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

  it('lets an invitation open either way, because accepting one needs a session', () => {
    for (const cookie of ['a-session-token', null]) {
      mocks.getSessionCookie.mockReturnValue(cookie)
      const response = proxy(request('/accept-invitation/invite-1'))
      expect(response.headers.get('location')).toBeNull()
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

  it('leaves the web manifest and app icons alone, since browsers fetch them without cookies', () => {
    const matches = (path: string) =>
      unstable_doesMiddlewareMatch({ config, url: path, nextConfig: { basePath: '/app' } })

    for (const path of [
      '/app/manifest.webmanifest',
      '/app/icon.svg',
      '/app/apple-icon.png',
      '/app/icon-192.png',
      '/app/icon-maskable-512.png',
    ]) {
      expect(matches(path), path).toBe(false)
    }
    for (const path of ['/app', '/app/hiring/reports', '/app/settings']) {
      expect(matches(path), path).toBe(true)
    }
  })
})
