import {
  EmploymentType,
  PostingStatus,
  PostingStatusFilter,
  Workplace,
  type HiringSettings as SettingsMessage,
  type Posting as PostingMessage,
  type SavePostingRequest,
  type Stage as StageMessage,
} from '@ihp/rpc/hiring'
import type {
  EmploymentType as Employment,
  HiringSettings,
  PostingDraftValues,
  PostingRow,
  PostingStatus as Status,
  PostingStatusFilter as StatusFilter,
  Stage,
  Workplace as Place,
} from '@/features/hiring/schema'
import { fieldFromProto, fieldToProto } from './requests-codec'

// The UI keeps its string unions and the wire keeps its enums; every crossing goes through
// these maps, so an UNSPECIFIED value from an older client falls back rather than throwing.
const STATUS_TO_PROTO: Record<Status, PostingStatus> = {
  draft: PostingStatus.DRAFT,
  open: PostingStatus.OPEN,
  closed: PostingStatus.CLOSED,
  archived: PostingStatus.ARCHIVED,
}

const STATUS_FROM_PROTO: Record<PostingStatus, Status> = {
  [PostingStatus.UNSPECIFIED]: 'draft',
  [PostingStatus.DRAFT]: 'draft',
  [PostingStatus.OPEN]: 'open',
  [PostingStatus.CLOSED]: 'closed',
  [PostingStatus.ARCHIVED]: 'archived',
}

const FILTER_TO_PROTO: Record<StatusFilter, PostingStatusFilter> = {
  current: PostingStatusFilter.CURRENT,
  draft: PostingStatusFilter.DRAFT,
  open: PostingStatusFilter.OPEN,
  closed: PostingStatusFilter.CLOSED,
  archived: PostingStatusFilter.ARCHIVED,
}

const FILTER_FROM_PROTO: Record<PostingStatusFilter, StatusFilter> = {
  [PostingStatusFilter.UNSPECIFIED]: 'current',
  [PostingStatusFilter.CURRENT]: 'current',
  [PostingStatusFilter.DRAFT]: 'draft',
  [PostingStatusFilter.OPEN]: 'open',
  [PostingStatusFilter.CLOSED]: 'closed',
  [PostingStatusFilter.ARCHIVED]: 'archived',
}

const WORKPLACE_TO_PROTO: Record<Place, Workplace> = {
  onsite: Workplace.ONSITE,
  hybrid: Workplace.HYBRID,
  remote: Workplace.REMOTE,
}

const WORKPLACE_FROM_PROTO: Record<Workplace, Place> = {
  [Workplace.UNSPECIFIED]: 'onsite',
  [Workplace.ONSITE]: 'onsite',
  [Workplace.HYBRID]: 'hybrid',
  [Workplace.REMOTE]: 'remote',
}

const EMPLOYMENT_TO_PROTO: Record<Employment, EmploymentType> = {
  full_time: EmploymentType.FULL_TIME,
  part_time: EmploymentType.PART_TIME,
  contract: EmploymentType.CONTRACT,
  internship: EmploymentType.INTERNSHIP,
  temporary: EmploymentType.TEMPORARY,
}

const EMPLOYMENT_FROM_PROTO: Record<EmploymentType, Employment> = {
  [EmploymentType.UNSPECIFIED]: 'full_time',
  [EmploymentType.FULL_TIME]: 'full_time',
  [EmploymentType.PART_TIME]: 'part_time',
  [EmploymentType.CONTRACT]: 'contract',
  [EmploymentType.INTERNSHIP]: 'internship',
  [EmploymentType.TEMPORARY]: 'temporary',
}

export function postingStatusToProto(status: Status) {
  return STATUS_TO_PROTO[status]
}

export function postingStatusFromProto(status: PostingStatus) {
  return STATUS_FROM_PROTO[status]
}

export function postingFilterToProto(status: StatusFilter) {
  return FILTER_TO_PROTO[status]
}

export function postingFilterFromProto(status: PostingStatusFilter) {
  return FILTER_FROM_PROTO[status]
}

export function stageToProto(stage: Stage): StageMessage {
  return {
    $typeName: 'ihp.hiring.v1.Stage',
    id: stage.id,
    name: stage.name,
    message: stage.message,
  }
}

export function stageFromProto(message: StageMessage): Stage {
  return { id: message.id, name: message.name, message: message.message }
}

export function settingsToProto(settings: HiringSettings): SettingsMessage {
  return {
    $typeName: 'ihp.hiring.v1.HiringSettings',
    hrTeamId: settings.hrTeamId,
    hrTeamName: settings.hrTeamName,
    defaultStages: settings.defaultStages.map(stageToProto),
    rejectionMessage: settings.rejectionMessage,
    canEditHrTeam: settings.canEditHrTeam,
  }
}

export function settingsFromProto(message: SettingsMessage): HiringSettings {
  return {
    hrTeamId: message.hrTeamId,
    hrTeamName: message.hrTeamName,
    defaultStages: message.defaultStages.map(stageFromProto),
    rejectionMessage: message.rejectionMessage,
    canEditHrTeam: message.canEditHrTeam,
  }
}

export function postingToProto(row: PostingRow): PostingMessage {
  return {
    $typeName: 'ihp.hiring.v1.Posting',
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    location: row.location,
    workplace: WORKPLACE_TO_PROTO[row.workplace],
    employmentType: EMPLOYMENT_TO_PROTO[row.employmentType],
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    status: STATUS_TO_PROTO[row.status],
    resumeRequired: row.resumeRequired,
    stages: row.stages.map(stageToProto),
    applicationFormId: row.applicationFormId,
    applicationFormName: row.applicationFormName,
    applicationFields: row.applicationFields.map(fieldToProto),
    teamId: row.teamId,
    teamName: row.teamName,
    openedAt: row.openedAt,
    closesAt: row.closesAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    applicantCount: row.applicantCount,
    activeCount: row.activeCount,
    stageCounts: row.stageCounts,
  }
}

export function postingFromProto(message: PostingMessage): PostingRow {
  return {
    id: message.id,
    slug: message.slug,
    title: message.title,
    summary: message.summary,
    description: message.description,
    location: message.location,
    workplace: WORKPLACE_FROM_PROTO[message.workplace],
    employmentType: EMPLOYMENT_FROM_PROTO[message.employmentType],
    salaryMin: message.salaryMin,
    salaryMax: message.salaryMax,
    salaryCurrency: message.salaryCurrency,
    status: STATUS_FROM_PROTO[message.status],
    resumeRequired: message.resumeRequired,
    stages: message.stages.map(stageFromProto),
    applicationFormId: message.applicationFormId,
    applicationFormName: message.applicationFormName,
    applicationFields: message.applicationFields.map(fieldFromProto),
    teamId: message.teamId,
    teamName: message.teamName,
    openedAt: message.openedAt,
    closesAt: message.closesAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    applicantCount: message.applicantCount,
    activeCount: message.activeCount,
    stageCounts: { ...message.stageCounts },
  }
}

type SavePostingFields = Omit<SavePostingRequest, '$typeName' | '$unknown'>

export function draftToProto(draft: PostingDraftValues): SavePostingFields {
  return {
    postingId: draft.postingId,
    title: draft.title,
    summary: draft.summary,
    description: draft.description,
    location: draft.location,
    workplace: WORKPLACE_TO_PROTO[draft.workplace],
    employmentType: EMPLOYMENT_TO_PROTO[draft.employmentType],
    salaryMin: draft.salaryMin === '' ? undefined : draft.salaryMin,
    salaryMax: draft.salaryMax === '' ? undefined : draft.salaryMax,
    salaryCurrency: draft.salaryCurrency,
    resumeRequired: draft.resumeRequired,
    stages: draft.stages.map(stageToProto),
    applicationFormId: draft.applicationFormId || undefined,
    teamId: draft.teamId || undefined,
    closesAt: draft.closesAt || undefined,
  }
}

export function draftFromProto(request: SavePostingRequest): PostingDraftValues {
  return {
    postingId: request.postingId,
    title: request.title,
    summary: request.summary,
    description: request.description,
    location: request.location,
    workplace: WORKPLACE_FROM_PROTO[request.workplace],
    employmentType: EMPLOYMENT_FROM_PROTO[request.employmentType],
    salaryMin: request.salaryMin ?? '',
    salaryMax: request.salaryMax ?? '',
    salaryCurrency: request.salaryCurrency || 'USD',
    resumeRequired: request.resumeRequired,
    stages: request.stages.map(stageFromProto),
    applicationFormId: request.applicationFormId ?? '',
    teamId: request.teamId ?? '',
    closesAt: request.closesAt ?? '',
  }
}
