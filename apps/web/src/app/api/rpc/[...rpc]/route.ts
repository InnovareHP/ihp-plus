import { createFetchRouter } from '@ihp/rpc'
import { registerRoutes } from '@/rpc/routes'

// One handler serves the Connect, gRPC-Web and gRPC protocols, which is why no Envoy or
// translating proxy appears anywhere in infra/.
const router = createFetchRouter(registerRoutes)

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
