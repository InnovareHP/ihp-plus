import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicRoute, routes } from '@/lib/routes'

// Cookie presence only — it proves nothing, so requireSession() revalidates in every layout.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
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
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
}
