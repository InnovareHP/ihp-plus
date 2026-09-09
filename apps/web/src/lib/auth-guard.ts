import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './auth'
import { routes } from './routes'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

// proxy.ts only sniffs the cookie, so every protected segment revalidates here.
export async function requireSession() {
  const session = await getSession()
  if (!session) redirect(routes.login)
  return session
}
