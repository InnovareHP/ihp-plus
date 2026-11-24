import { ConnectError, createFetchRouter, type Interceptor } from '@ihp/rpc'
import { registerRoutes } from '@/rpc/routes'

// Connect masks any non-ConnectError as "internal error" and never logs the cause.
const logUnexpected: Interceptor = (next) => async (request) => {
  try {
    return await next(request)
  } catch (error) {
    if (!(error instanceof ConnectError)) console.error(`[rpc] ${request.url}`, error)
    throw error
  }
}

// One handler serves the Connect, gRPC-Web and gRPC protocols, which is why no Envoy or
// translating proxy appears anywhere in infra/.
const router = createFetchRouter(registerRoutes, { interceptors: [logUnexpected] })

// The services read cookies through next/headers, so a cached response would be another
// user's data.
export const dynamic = 'force-dynamic'

export function POST(request: Request) {
  return router.handle(request)
}

// gRPC-Web and Connect's GET-able unary calls both arrive here too.
export function GET(request: Request) {
  return router.handle(request)
}
