import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

// Sign-in, callbacks, and session reads all sit here; none of it may be statically evaluated.
export const dynamic = 'force-dynamic'

export const { GET, POST } = toNextJsHandler(auth)
