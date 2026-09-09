import { auth } from '@/lib/auth'
import { BASE_PATH } from '@/lib/routes'

// Sign-in, callbacks, and session reads all sit here; none of it may be statically evaluated.
export const dynamic = 'force-dynamic'

// Next strips basePath from request.url, but Better Auth routes on the URL the browser asked for.
async function restoreBasePath(request: Request) {
  const url = new URL(request.url)
  if (url.pathname.startsWith(`${BASE_PATH}/`)) return request

  url.pathname = `${BASE_PATH}${url.pathname}`
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  // Buffered, not streamed: passing a Request as init drops the method on some runtimes.
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : null,
  })
}

export async function GET(request: Request) {
  return auth.handler(await restoreBasePath(request))
}

export async function POST(request: Request) {
  return auth.handler(await restoreBasePath(request))
}
