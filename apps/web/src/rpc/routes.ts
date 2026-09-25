import type { ConnectRouter, ServiceImpl } from '@ihp/rpc'
import { AttendanceService } from '@ihp/rpc/attendance'
import { BulletinService } from '@ihp/rpc/bulletin'
import { ContractsService } from '@ihp/rpc/contracts'
import { DirectoryService } from '@ihp/rpc/directory'
import { EvaluationsService } from '@ihp/rpc/evaluations'
import { LookupsService } from '@ihp/rpc/lookups'
import { MembersService } from '@ihp/rpc/members'
import { RequestsService } from '@ihp/rpc/requests'
import { TasksService } from '@ihp/rpc/tasks'
import {
  applyEmploymentStatus,
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
import { attendance } from './attendance-routes'
import { bulletin } from './bulletin-routes'
import { contracts } from './contracts-routes'
import { directory } from './directory-routes'
import { evaluations } from './evaluations-routes'
import { lookups } from './lookups-routes'
import { requests } from './requests-routes'
import { tasks } from './tasks-routes'

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
      employmentStatuses: [...options.employmentStatuses],
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

  setEmploymentStatus: async (request) => ({
    member: memberToProto(
      await applyEmploymentStatus({
        userId: request.userId,
        employmentStatus: request.employmentStatus,
      }),
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
  router.service(RequestsService, requests)
  router.service(LookupsService, lookups)
  router.service(ContractsService, contracts)
  router.service(DirectoryService, directory)
  router.service(EvaluationsService, evaluations)
  router.service(TasksService, tasks)
  router.service(AttendanceService, attendance)
  router.service(BulletinService, bulletin)
}
