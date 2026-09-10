import {
  MemberSortKey,
  MemberStatus,
  OrganizationRole,
  PortalRole,
  SortDirection,
  type Member,
  type MemberQuery as MemberQueryMessage,
} from '@ihp/rpc/members'
import { DEFAULT_MEMBER_QUERY } from '@/features/members/schema'
import type {
  MemberQuery,
  MemberRow,
  MemberSortKey as SortKey,
  MemberStatus as Status,
  OrganizationRole as OrgRole,
  PortalRole as Portal,
} from '@/features/members/schema'
import type { SortDirection as Direction } from '@/lib/pagination'

// The UI keeps its string unions and the wire keeps its enums; every crossing goes through
// these maps, so an UNSPECIFIED value from an older client falls back rather than throwing.
const ORG_ROLE_TO_PROTO: Record<OrgRole, OrganizationRole> = {
  owner: OrganizationRole.OWNER,
  admin: OrganizationRole.ADMIN,
  member: OrganizationRole.MEMBER,
}

const ORG_ROLE_FROM_PROTO: Record<OrganizationRole, OrgRole> = {
  [OrganizationRole.UNSPECIFIED]: 'member',
  [OrganizationRole.OWNER]: 'owner',
  [OrganizationRole.ADMIN]: 'admin',
  [OrganizationRole.MEMBER]: 'member',
}

const PORTAL_ROLE_TO_PROTO: Record<Portal, PortalRole> = {
  admin: PortalRole.ADMIN,
  user: PortalRole.USER,
}

const PORTAL_ROLE_FROM_PROTO: Record<PortalRole, Portal> = {
  [PortalRole.UNSPECIFIED]: 'user',
  [PortalRole.ADMIN]: 'admin',
  [PortalRole.USER]: 'user',
}

const STATUS_TO_PROTO: Record<Status, MemberStatus> = {
  all: MemberStatus.ALL,
  active: MemberStatus.ACTIVE,
  suspended: MemberStatus.SUSPENDED,
}

const STATUS_FROM_PROTO: Record<MemberStatus, Status> = {
  [MemberStatus.UNSPECIFIED]: 'all',
  [MemberStatus.ALL]: 'all',
  [MemberStatus.ACTIVE]: 'active',
  [MemberStatus.SUSPENDED]: 'suspended',
}

const SORT_KEY_TO_PROTO: Record<SortKey, MemberSortKey> = {
  name: MemberSortKey.NAME,
  email: MemberSortKey.EMAIL,
  organizationRole: MemberSortKey.ORGANIZATION_ROLE,
  portalRole: MemberSortKey.PORTAL_ROLE,
  jobTitle: MemberSortKey.JOB_TITLE,
  startDate: MemberSortKey.START_DATE,
  createdAt: MemberSortKey.CREATED_AT,
}

const SORT_KEY_FROM_PROTO: Record<MemberSortKey, SortKey> = {
  [MemberSortKey.UNSPECIFIED]: 'name',
  [MemberSortKey.NAME]: 'name',
  [MemberSortKey.EMAIL]: 'email',
  [MemberSortKey.ORGANIZATION_ROLE]: 'organizationRole',
  [MemberSortKey.PORTAL_ROLE]: 'portalRole',
  [MemberSortKey.JOB_TITLE]: 'jobTitle',
  [MemberSortKey.START_DATE]: 'startDate',
  [MemberSortKey.CREATED_AT]: 'createdAt',
}

const DIRECTION_TO_PROTO: Record<Direction, SortDirection> = {
  asc: SortDirection.ASC,
  desc: SortDirection.DESC,
}

const DIRECTION_FROM_PROTO: Record<SortDirection, Direction> = {
  [SortDirection.UNSPECIFIED]: 'asc',
  [SortDirection.ASC]: 'asc',
  [SortDirection.DESC]: 'desc',
}

export function organizationRoleToProto(role: OrgRole): OrganizationRole {
  return ORG_ROLE_TO_PROTO[role]
}

export function portalRoleToProto(role: Portal): PortalRole {
  return PORTAL_ROLE_TO_PROTO[role]
}

export function organizationRoleFromProto(role: OrganizationRole): OrgRole {
  return ORG_ROLE_FROM_PROTO[role]
}

export function portalRoleFromProto(role: PortalRole): Portal {
  return PORTAL_ROLE_FROM_PROTO[role]
}

export function queryToProto(query: MemberQuery): MemberQueryMessage {
  return {
    $typeName: 'ihp.members.v1.MemberQuery',
    search: query.search,
    organizationRoles: query.organizationRoles.map((role) => ORG_ROLE_TO_PROTO[role]),
    portalRoles: query.portalRoles.map((role) => PORTAL_ROLE_TO_PROTO[role]),
    employmentTypes: [...query.employmentTypes],
    teamIds: [...query.teamIds],
    status: STATUS_TO_PROTO[query.status],
    startDateFrom: query.startDateFrom,
    startDateTo: query.startDateTo,
    sortBy: SORT_KEY_TO_PROTO[query.sortBy],
    sortDirection: DIRECTION_TO_PROTO[query.sortDirection],
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function queryFromProto(message: MemberQueryMessage | undefined): MemberQuery {
  if (!message) return DEFAULT_MEMBER_QUERY

  return {
    search: message.search,
    organizationRoles: message.organizationRoles.map((role) => ORG_ROLE_FROM_PROTO[role]),
    portalRoles: message.portalRoles.map((role) => PORTAL_ROLE_FROM_PROTO[role]),
    employmentTypes: message.employmentTypes,
    teamIds: message.teamIds,
    status: STATUS_FROM_PROTO[message.status],
    startDateFrom: message.startDateFrom,
    startDateTo: message.startDateTo,
    sortBy: SORT_KEY_FROM_PROTO[message.sortBy],
    sortDirection: DIRECTION_FROM_PROTO[message.sortDirection],
    // A page of zero means the field was never set, so the default stands in.
    page: message.page || DEFAULT_MEMBER_QUERY.page,
    pageSize: message.pageSize || DEFAULT_MEMBER_QUERY.pageSize,
  } as MemberQuery
}

export function memberToProto(row: MemberRow): Member {
  return {
    $typeName: 'ihp.members.v1.Member',
    memberId: row.memberId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    organizationRole: ORG_ROLE_TO_PROTO[row.organizationRole],
    portalRole: PORTAL_ROLE_TO_PROTO[row.portalRole],
    team: row.team,
    jobTitle: row.jobTitle,
    ihpId: row.ihpId,
    startDate: row.startDate,
    banned: row.banned,
    isSelf: row.isSelf,
  }
}

export function memberFromProto(member: Member): MemberRow {
  return {
    memberId: member.memberId,
    userId: member.userId,
    name: member.name,
    email: member.email,
    organizationRole: ORG_ROLE_FROM_PROTO[member.organizationRole],
    portalRole: PORTAL_ROLE_FROM_PROTO[member.portalRole],
    team: member.team,
    jobTitle: member.jobTitle,
    ihpId: member.ihpId,
    startDate: member.startDate,
    banned: member.banned,
    isSelf: member.isSelf,
  }
}
