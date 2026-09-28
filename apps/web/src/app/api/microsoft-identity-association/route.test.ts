import { afterEach, describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/microsoft-identity-association', () => {
  afterEach(() => {
    delete process.env.MICROSOFT_CLIENT_ID
  })

  it('names the sign-in app, for Entra publisher verification', async () => {
    process.env.MICROSOFT_CLIENT_ID = '68164c04-6a94-448c-9b13-32b64ba878e6'

    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      associatedApplications: [{ applicationId: '68164c04-6a94-448c-9b13-32b64ba878e6' }],
    })
  })

  it('answers 404 when Microsoft sign-in is not configured', () => {
    expect(GET().status).toBe(404)
  })
})
