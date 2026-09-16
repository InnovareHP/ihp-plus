'use client'

import { ConnectError } from '@ihp/rpc'
import type { Member } from '@ihp/rpc/members'
import { browserClients } from '@/rpc/browser'
import {
  memberFromProto,
  organizationRoleToProto,
  portalRoleToProto,
  queryToProto,
} from '@/rpc/members-codec'
import type {
  MemberFilterOptions,
  MemberQuery,
  MemberRow,
  MembersPage,
  OrganizationRole,
  PortalRole,
} from './schema'

/**
 * ConnectError stringifies as "[permission_denied] ...", putting a machine code in front of a
 * sentence a user reads. The code stays on the ConnectError for anything that branches on it;
 * what reaches the UI is the plain message.
 */
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

// A mutation always answers with the row it wrote; a response without one is a broken server.
function updatedRow(member: Member | undefined): MemberRow {
  if (!member) throw new Error('The server did not return the updated member.')
  return memberFromProto(member)
}

export async function listMembers(query: MemberQuery): Promise<MembersPage> {
  const response = await call(() =>
    browserClients.members.listMembers({ query: queryToProto(query) }),
  )
  const pageInfo = response.pageInfo

  if (!pageInfo) throw new Error('The server did not return page information.')

  return {
    rows: response.rows.map(memberFromProto),
    pageInfo: {
      page: pageInfo.page,
      pageSize: pageInfo.pageSize,
      total: pageInfo.total,
      pageCount: pageInfo.pageCount,
      hasPrevious: pageInfo.hasPrevious,
      hasNext: pageInfo.hasNext,
    },
  }
}

export async function listMemberFilterOptions(): Promise<MemberFilterOptions> {
  const response = await call(() => browserClients.members.listMemberFilterOptions({}))

  return {
    teams: response.teams.map((team) => ({
      id: team.teamId,
      name: team.name,
      memberCount: team.memberCount,
    })),
    employmentTypes: response.employmentTypes,
    employmentStatuses: response.employmentStatuses,
  }
}

export async function setOrganizationRole(values: {
  memberId: string
  role: OrganizationRole
}): Promise<MemberRow> {
  const response = await call(() =>
    browserClients.members.setOrganizationRole({
      memberId: values.memberId,
      role: organizationRoleToProto(values.role),
    }),
  )
  return updatedRow(response.member)
}

export async function setPortalRole(values: {
  userId: string
  role: PortalRole
}): Promise<MemberRow> {
  const response = await call(() =>
    browserClients.members.setPortalRole({
      userId: values.userId,
      role: portalRoleToProto(values.role),
    }),
  )
  return updatedRow(response.member)
}

export async function setEmploymentStatus(values: {
  userId: string
  employmentStatus: string
}): Promise<MemberRow> {
  const response = await call(() => browserClients.members.setEmploymentStatus(values))
  return updatedRow(response.member)
}

export async function setBanned(values: { userId: string; banned: boolean }): Promise<MemberRow> {
  const response = await call(() =>
    browserClients.members.setMemberAccess({ userId: values.userId, banned: values.banned }),
  )
  return updatedRow(response.member)
}
