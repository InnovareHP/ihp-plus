import { createAuthClient } from 'better-auth/react'
import { AUTH_BASE_PATH } from './routes'

// No baseURL: the browser resolves it from window.location, keeping dev and the proxy origin honest.
export const authClient = createAuthClient({ basePath: AUTH_BASE_PATH })

export const { signIn, signUp, signOut, useSession } = authClient
