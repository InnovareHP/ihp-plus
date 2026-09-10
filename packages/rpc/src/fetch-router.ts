import {
  createConnectRouter,
  type ConnectRouter,
  type ConnectRouterOptions,
} from '@connectrpc/connect'
import { createFetchHandler } from '@connectrpc/connect/protocol'

export type RegisterRoutes = (router: ConnectRouter) => void

// `duplex` is required whenever a request body is a stream, and lib.dom has not caught up.
interface StreamingRequestInit extends RequestInit {
  duplex?: 'half'
}

export interface FetchRouter {
  /** Handles one Connect/gRPC-Web request, or returns 404 for an unknown method. */
  handle: (request: Request) => Promise<Response>
}

/**
 * Adapts a Connect router to the Web Request/Response pair an App Router handler is given.
 * Matching is on the tail of the path — `/<package.Service>/<Method>` is unique enough — so
 * it holds whether or not Next has stripped basePath from the URL by the time we see it.
 */
export function createFetchRouter(register: RegisterRoutes, options?: ConnectRouterOptions) {
  const router = createConnectRouter(options)
  register(router)

  const handlers = router.handlers.map((handler) => ({
    requestPath: handler.requestPath,
    handle: createFetchHandler(handler),
  }))

  return {
    async handle(request: Request) {
      const url = new URL(request.url)
      const match = handlers.find((handler) => url.pathname.endsWith(handler.requestPath))
      if (!match) return new Response('unknown method', { status: 404 })

      // The handler matches on its own request path, so it is given the URL it expects.
      // Method and body are copied across explicitly: a Request is not a valid RequestInit.
      const init: StreamingRequestInit = {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
        duplex: 'half',
      }
      return match.handle(new Request(new URL(match.requestPath + url.search, url.origin), init))
    },
  } satisfies FetchRouter
}
