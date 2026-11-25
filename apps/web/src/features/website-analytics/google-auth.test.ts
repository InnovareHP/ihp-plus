import { generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyticsToken, forgetAnalyticsToken, GoogleAuthError } from './google-auth'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const KEY = Buffer.from(
  JSON.stringify({
    client_email: 'reports@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
).toString('base64')

const fetchMock = vi.fn()

beforeEach(() => {
  forgetAnalyticsToken()
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_KEY', KEY)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 })),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('analyticsToken', () => {
  it('trades a signed read-only request for a token', async () => {
    expect(await analyticsToken(1_000_000)).toBe('token-1')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const assertion = new URLSearchParams(String(init.body)).get('assertion') ?? ''
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1] ?? '', 'base64url').toString())
    expect(claims).toMatchObject({
      iss: 'reports@example.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
    })
  })

  it('reuses the token until a minute before it expires', async () => {
    await analyticsToken(0)
    await analyticsToken(3_500_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await analyticsToken(3_550_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('names the problem when the key is missing or malformed', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_KEY', '')
    await expect(analyticsToken()).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_KEY is not set.')

    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_KEY', Buffer.from('{"nope":1}').toString('base64'))
    await expect(analyticsToken()).rejects.toBeInstanceOf(GoogleAuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails when Google refuses the account', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }))

    await expect(analyticsToken()).rejects.toThrow('Google refused the service account (400).')
  })
})
