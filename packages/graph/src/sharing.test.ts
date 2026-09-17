import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inviteGuest, revokePermission, shareItem } from './sharing'
import { getAccessToken, resetTokenCache } from './token'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  process.env.GRAPH_TENANT_ID = 'tenant-1'
  process.env.GRAPH_CLIENT_ID = 'client-1'
  process.env.GRAPH_CLIENT_SECRET = 'secret-1'
  resetTokenCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'token-1', expires_in: 3600 }))
  await getAccessToken()
  fetchMock.mockClear()
})

function bodyOf(call: unknown[]) {
  return JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>
}

describe('shareItem', () => {
  it('grants read access without letting Graph send its own mail', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ value: [{ id: 'perm-1', roles: ['read'] }] }))

    const result = await shareItem('drive-2', 'folder-1', ['buyer@acme.test'])

    expect(result.granted.map((permission) => permission.id)).toEqual(['perm-1'])
    expect(result.failed).toEqual([])
    expect(bodyOf(fetchMock.mock.calls[0] ?? [])).toMatchObject({
      roles: ['read'],
      requireSignIn: true,
      sendInvitation: false,
    })
  })

  it('separates the recipients Graph refused in a 207 from the ones it granted', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          value: [
            { id: 'perm-1', invitation: { email: 'ok@acme.test' } },
            {
              id: 'perm-2',
              invitation: { email: 'blocked@acme.test' },
              error: { code: 'notAllowed', message: 'External sharing is off for this site.' },
            },
          ],
        },
        { status: 207 },
      ),
    )

    const result = await shareItem('drive-2', 'folder-1', ['ok@acme.test', 'blocked@acme.test'])

    expect(result.granted.map((permission) => permission.id)).toEqual(['perm-1'])
    expect(result.failed).toEqual([
      { email: 'blocked@acme.test', message: 'External sharing is off for this site.' },
    ])
  })
})

describe('inviteGuest', () => {
  it('creates the B2B guest quietly, because the portal sends its own invitation', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'invite-1',
        invitedUserEmailAddress: 'buyer@acme.test',
        invitedUser: { id: 'user-9' },
      }),
    )

    const invitation = await inviteGuest('buyer@acme.test', 'Acme Buyer', 'https://portal.test/app')

    expect(invitation.invitedUser?.id).toBe('user-9')
    expect(bodyOf(fetchMock.mock.calls[0] ?? [])).toMatchObject({
      invitedUserEmailAddress: 'buyer@acme.test',
      sendInvitationMessage: false,
    })
  })
})

describe('revokePermission', () => {
  it('accepts the empty 204 a delete answers with', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(revokePermission('drive-2', 'folder-1', 'perm-1')).resolves.toBeUndefined()
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE')
  })
})
