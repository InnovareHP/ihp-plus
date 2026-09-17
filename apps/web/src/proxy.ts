import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicRoute, isSharedRoute, routes } from '@/lib/routes'

// Cookie presence only — it proves nothing, so requireSession() revalidates in every layout.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isSharedRoute(pathname)) return NextResponse.next()

  const isPublic = isPublicRoute(pathname)
  const hasSessionCookie = Boolean(getSessionCookie(request))

  if (!hasSessionCookie && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = routes.login
    url.search = ''
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (hasSessionCookie && isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = routes.dashboard
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // '/' is listed separately: a matcher group requires one character, so it misses the root.
  matcher: ['/', '/((?!api/|_next/static|_next/image|favicon.ico).*)'],
}
