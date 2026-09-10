import {
  Code,
  ConnectError,
  createClient,
  createConnectTransport,
  createFetchRouter,
  createRouterTransport,
  type ConnectRouter,
} from '@ihp/rpc'
import { MembersService, OrganizationRole, PortalRole } from '@ihp/rpc/members'
import { describe, expect, it } from 'vitest'

// A stand-in implementation: this covers the generated contract and both transports,
// not the real service, which reads Postgres.
function register(router: ConnectRouter) {
  router.service(MembersService, {
    listMembers: () => ({
      pageInfo: {
        $typeName: 'ihp.members.v1.PageInfo' as const,
        page: 1,
        pageSize: 25,
        total: 1,
        pageCount: 1,
        hasPrevious: false,
        hasNext: false,
      },
      rows: [
        {
          $typeName: 'ihp.members.v1.Member' as const,
          memberId: 'member-1',
          userId: 'user-1',
          name: 'Ada Lovelace',
          email: 'ada@innovarehp.com',
          organizationRole: OrganizationRole.MEMBER,
          portalRole: PortalRole.USER,
          team: 'Information Technology',
          banned: false,
          isSelf: false,
        },
      ],
    }),
    setPortalRole: () => {
      throw new ConnectError('You cannot remove your own portal admin role.', Code.PermissionDenied)
    },
  })
}

describe('rpc contract', () => {
  it('round-trips a response through the in-process transport', async () => {
    const client = createClient(MembersService, createRouterTransport(register))

    const { rows, pageInfo } = await client.listMembers({})

    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Ada Lovelace')
    expect(pageInfo?.total).toBe(1)
    // Enums arrive as numbers, so the UI must map them rather than compare strings.
    expect(rows[0]?.organizationRole).toBe(OrganizationRole.MEMBER)
  })

  it('carries a Connect error code rather than an ok/message union', async () => {
    const client = createClient(MembersService, createRouterTransport(register))

    await expect(client.setPortalRole({ userId: 'user-1', role: PortalRole.USER })).rejects.toThrow(
      /portal admin role/,
    )
    const error = await client.setPortalRole({ userId: 'u', role: PortalRole.USER }).catch((e) => e)
    expect(ConnectError.from(error).code).toBe(Code.PermissionDenied)
  })

  it('reports unimplemented for a method the router does not register', async () => {
    const client = createClient(MembersService, createRouterTransport(register))

    const error = await client
      .setMemberAccess({ userId: 'user-1', banned: true })
      .catch((e: unknown) => e)
    expect(ConnectError.from(error).code).toBe(Code.Unimplemented)
  })

  it('serves the same contract over HTTP through the fetch router', async () => {
    const router = createFetchRouter(register)
    const transport = createConnectTransport({
      baseUrl: 'http://localhost/app/api/rpc',
      // Routed straight into the handler, so no server has to be listening.
      fetch: (input, init) => router.handle(new Request(input as string, init)),
    })

    const { rows } = await createClient(MembersService, transport).listMembers({})

    expect(rows[0]?.email).toBe('ada@innovarehp.com')
  })

  it('404s an unknown method instead of throwing', async () => {
    const router = createFetchRouter(register)

    const response = await router.handle(
      new Request('http://localhost/api/rpc/ihp.members.v1.Nope/Missing', { method: 'POST' }),
    )

    expect(response.status).toBe(404)
  })
})
