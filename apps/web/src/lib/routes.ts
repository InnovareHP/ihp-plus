// Next's basePath: every route below is written without it, and next/link prepends it.
export const BASE_PATH = '/app'

export const routes = {
  dashboard: '/',
  onboarding: '/onboarding',
  members: '/members',
  settings: '/settings',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
} as const

export type Route = (typeof routes)[keyof typeof routes]

// The (auth) route group is invisible in the URL, so the guard matches these prefixes instead.
export const PUBLIC_ROUTES: readonly Route[] = [
  routes.login,
  routes.signup,
  routes.forgotPassword,
  routes.resetPassword,
]

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

// OAuth callbacks and Better Auth's own base are real browser URLs, so they carry the basePath.
export function withBasePath(route: string) {
  return route === '/' ? BASE_PATH : `${BASE_PATH}${route}`
}

export const AUTH_BASE_PATH = withBasePath('/api/auth')
