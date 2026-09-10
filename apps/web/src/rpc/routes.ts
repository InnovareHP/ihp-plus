import type { ConnectRouter, ServiceImpl } from '@ihp/rpc'
import { MembersService } from '@ihp/rpc/members'
import {
  applyMemberAccess,
  applyOrganizationRole,
  applyPortalRole,
  loadFilterOptions,
  loadMembersPage,
} from '@/features/members/service'
import {
  memberToProto,
  organizationRoleFromProto,
  portalRoleFromProto,
  queryFromProto,
} from './members-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
const members: ServiceImpl<typeof MembersService> = {
  listMembers: async (request) => {
    const page = await loadMembersPage(queryFromProto(request.query))
    return {
      rows: page.rows.map(memberToProto),
      pageInfo: { $typeName: 'ihp.members.v1.PageInfo', ...page.pageInfo },
    }
  },

  listMemberFilterOptions: async () => {
    const options = await loadFilterOptions()
    return {
      teams: options.teams.map((team) => ({
        $typeName: 'ihp.members.v1.TeamOption' as const,
        teamId: team.id,
        name: team.name,
        memberCount: team.memberCount,
      })),
      employmentTypes: [...options.employmentTypes],
    }
  },

  setOrganizationRole: async (request) => ({
    member: memberToProto(
      await applyOrganizationRole({
        memberId: request.memberId,
        role: organizationRoleFromProto(request.role),
      }),
    ),
  }),

  setPortalRole: async (request) => ({
    member: memberToProto(
      await applyPortalRole({ userId: request.userId, role: portalRoleFromProto(request.role) }),
    ),
  }),

  setMemberAccess: async (request) => ({
    member: memberToProto(
      await applyMemberAccess({ userId: request.userId, banned: request.banned }),
    ),
  }),
}

export function registerRoutes(router: ConnectRouter) {
  router.service(MembersService, members)
}
