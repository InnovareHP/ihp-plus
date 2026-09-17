import { getAccessToken } from './token'

const BASE_URL = 'https://graph.microsoft.com/v1.0'
const MAX_ATTEMPTS = 5
const MAX_BACKOFF_MS = 60_000

export class GraphError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | undefined

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message)
    this.name = 'GraphError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }

  /** Graph answers a missing item with 404 and a copy monitor with 404 while it starts. */
  get isNotFound() {
    return this.status === 404
  }

  get isConflict() {
    return this.status === 409
  }
}

export interface GraphRequest {
  method?: string
  body?: unknown
  /** File bytes, sent as they are — `body` is for JSON and gets stringified. */
  rawBody?: BodyInit | Uint8Array
  headers?: Record<string, string>
  /** Absolute URLs come back from Graph itself — delta links, monitor URLs, @odata.nextLink. */
  absolute?: boolean
  signal?: AbortSignal
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryable(status: number) {
  return status === 429 || status === 503 || status === 504 || status === 509
}

/** Graph states the wait on a throttled response; guessing shorter only earns another 429. */
function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get('retry-after')
  const seconds = header ? Number(header) : Number.NaN
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS)
  const backoff = Math.min(2 ** attempt * 500, MAX_BACKOFF_MS)
  return backoff / 2 + Math.random() * (backoff / 2)
}

async function toError(response: Response) {
  const payload = (await response.json().catch(() => undefined)) as
    { error?: { code?: string; message?: string } } | undefined
  return new GraphError(
    response.status,
    payload?.error?.code ?? `http_${response.status}`,
    payload?.error?.message ?? `Graph request failed with ${response.status}.`,
    response.headers.get('request-id') ?? undefined,
  )
}

export async function graphFetch(path: string, request: GraphRequest = {}) {
  const url = request.absolute ? path : `${BASE_URL}${path}`
  const method = request.method ?? 'GET'
  let forceToken = false

  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken({ force: forceToken })
    forceToken = false

    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...request.headers,
      },
      // fetch takes a Uint8Array at runtime, but lib.dom types BodyInit without it.
      body:
        (request.rawBody as BodyInit | undefined) ??
        (request.body === undefined ? undefined : JSON.stringify(request.body)),
      signal: request.signal,
    })

    if (response.ok || response.status === 202) return response

    // A token can be revoked mid-run, so one 401 buys a fresh token rather than a failure.
    if (response.status === 401 && attempt === 0) {
      forceToken = true
      continue
    }
    if (retryable(response.status) && attempt < MAX_ATTEMPTS - 1) {
      await sleep(retryDelay(response, attempt))
      continue
    }

    throw await toError(response)
  }
}

export async function graphJson<T>(path: string, request: GraphRequest = {}) {
  const response = await graphFetch(path, request)
  return (await response.json()) as T
}

export async function graphVoid(path: string, request: GraphRequest = {}) {
  const response = await graphFetch(path, request)
  // 204 is the usual answer to a delete, and reading its empty body throws.
  if (response.status !== 204) await response.arrayBuffer()
}
