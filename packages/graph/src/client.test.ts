import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphError, graphFetch, graphJson } from './client'
import { GraphNotConfiguredError, isGraphConfigured } from './config'
import { getAccessToken, resetTokenCache } from './token'

const TOKEN_URL = 'https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function tokenResponse(accessToken = 'token-1', expiresIn = 3600) {
  return jsonResponse({ access_token: accessToken, expires_in: expiresIn })
}

function configure() {
  process.env.GRAPH_TENANT_ID = 'tenant-1'
  process.env.GRAPH_CLIENT_ID = 'client-1'
  process.env.GRAPH_CLIENT_SECRET = 'secret-1'
  delete process.env.GRAPH_CLIENT_CERT_PRIVATE_KEY
  delete process.env.GRAPH_CLIENT_CERT_THUMBPRINT
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  configure()
  resetTokenCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('configuration', () => {
  it('treats the multi-tenant `common` login value as unconfigured', () => {
    process.env.GRAPH_TENANT_ID = 'common'
    expect(isGraphConfigured()).toBe(false)
  })

  it('needs a secret or a certificate, not just a client id', () => {
    delete process.env.GRAPH_CLIENT_SECRET
    expect(isGraphConfigured()).toBe(false)
  })

  it('reports configured once a tenant, client and secret are set', () => {
    expect(isGraphConfigured()).toBe(true)
  })
})

describe('getAccessToken', () => {
  it('caches the token across calls', async () => {
    fetchMock.mockResolvedValue(tokenResponse())

    await getAccessToken()
    await getAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(TOKEN_URL)
  })

  it('asks once when several callers find the cache cold at the same moment', async () => {
    fetchMock.mockResolvedValue(tokenResponse())

    const [first, second] = await Promise.all([getAccessToken(), getAccessToken()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
  })

  it('re-requests a token that is inside the expiry skew', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse('token-1', 30))
    fetchMock.mockResolvedValueOnce(tokenResponse('token-2', 3600))

    expect(await getAccessToken()).toBe('token-1')
    expect(await getAccessToken()).toBe('token-2')
  })

  it('surfaces the reason Entra refused the credential', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret.' },
        { status: 401 },
      ),
    )

    await expect(getAccessToken()).rejects.toThrow('AADSTS7000215')
  })

  it('throws GraphNotConfiguredError rather than calling out unconfigured', async () => {
    delete process.env.GRAPH_CLIENT_SECRET

    await expect(getAccessToken()).rejects.toBeInstanceOf(GraphNotConfiguredError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('graphFetch', () => {
  it('waits the interval Graph asks for and retries a 429', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse())
    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 429, headers: { 'retry-after': '0' } }),
    )
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'item-1' }))

    const payload = await graphJson<{ id: string }>('/drives/d/items/item-1')

    expect(payload.id).toBe('item-1')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('buys one fresh token on a 401 before giving up', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse('token-1'))
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    fetchMock.mockResolvedValueOnce(tokenResponse('token-2'))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'item-1' }))

    await graphJson('/drives/d/items/item-1')

    const authHeaders = fetchMock.mock.calls
      .filter((call) => call[0] !== TOKEN_URL)
      .map((call) => (call[1] as RequestInit).headers as Record<string, string>)
    expect(authHeaders[0]?.authorization).toBe('Bearer token-1')
    expect(authHeaders[1]?.authorization).toBe('Bearer token-2')
  })

  it('maps an error body to GraphError with its code and request id', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse())
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { code: 'itemNotFound', message: 'The resource could not be found.' } },
        { status: 404, headers: { 'content-type': 'application/json', 'request-id': 'req-9' } },
      ),
    )

    const error = await graphFetch('/drives/d/items/missing').catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(GraphError)
    expect(error).toMatchObject({ status: 404, code: 'itemNotFound', requestId: 'req-9' })
    expect((error as GraphError).isNotFound).toBe(true)
  })

  it('returns a 202 as a result, since a copy answers with one', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse())
    fetchMock.mockResolvedValueOnce(
      new Response('', { status: 202, headers: { location: 'https://monitor.example/1' } }),
    )

    const response = await graphFetch('/drives/d/items/i/copy', { method: 'POST', body: {} })

    expect(response.status).toBe(202)
    expect(response.headers.get('location')).toBe('https://monitor.example/1')
  })

  it('sends a delta link as an absolute URL rather than under the base path', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse())
    fetchMock.mockResolvedValueOnce(jsonResponse({ value: [] }))

    await graphJson('https://graph.microsoft.com/v1.0/drives/d/root/delta?token=abc', {
      absolute: true,
    })

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://graph.microsoft.com/v1.0/drives/d/root/delta?token=abc',
    )
  })
})
