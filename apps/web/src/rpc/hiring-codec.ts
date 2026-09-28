import {
  ApplicationStatus,
  ApplicationStatusFilter,
  EmploymentType,
  InterviewFormat,
  InterviewStatus,
  OfferStatus as OfferStatusEnum,
  Recommendation as RecommendationEnum,
  PostingStatus,
  PostingStatusFilter,
  SalaryPeriod,
  Workplace,
  type Application as ApplicationMessage,
  type ApplicationEvent as EventMessage,
  type ApplicationFile as FileMessage,
  type ApplicationNote as NoteMessage,
  type ApplicationSummary as SummaryMessage,
  type Interview as InterviewMessage,
  type Interviewer as InterviewerMessage,
  type Offer as OfferMessage,
  type InterviewerView as InterviewerViewMessage,
  type Scorecard as ScorecardMessage,
  type HiringSettings as SettingsMessage,
  type Posting as PostingMessage,
  type SavePostingRequest,
  type Stage as StageMessage,
} from '@ihp/rpc/hiring'
import type {
  ApplicationDetail,
  ApplicationEventRow,
  ApplicationFile,
  ApplicationNote,
  ApplicationStatus as AppStatus,
  ApplicationStatusFilter as AppStatusFilter,
  ApplicationSummary,
  EmploymentType as Employment,
  InterviewFormat as Format,
  InterviewRow,
  InterviewStatus as InterviewState,
  Interviewer,
  InterviewerView,
  OfferRow,
  OfferStatus as OfferState,
  Recommendation,
  ScorecardRow,
  HiringSettings,
  PostingDraftValues,
  PostingRow,
  PostingStatus as Status,
  PostingStatusFilter as StatusFilter,
  SalaryPeriod as Period,
  Stage,
  Workplace as Place,
} from '@/features/hiring/schema'
import { fieldFromProto, fieldToProto, valuesFromProto, valuesToProto } from './requests-codec'

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

const PERIOD_TO_PROTO: Record<Period, SalaryPeriod> = {
  year: SalaryPeriod.YEAR,
  month: SalaryPeriod.MONTH,
  hour: SalaryPeriod.HOUR,
}

const PERIOD_FROM_PROTO: Record<SalaryPeriod, Period> = {
  [SalaryPeriod.UNSPECIFIED]: 'year',
  [SalaryPeriod.YEAR]: 'year',
  [SalaryPeriod.MONTH]: 'month',
  [SalaryPeriod.HOUR]: 'hour',
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
    timeZone: settings.timeZone,
  }
}

export function settingsFromProto(message: SettingsMessage): HiringSettings {
  return {
    hrTeamId: message.hrTeamId,
    hrTeamName: message.hrTeamName,
    defaultStages: message.defaultStages.map(stageFromProto),
    rejectionMessage: message.rejectionMessage,
    canEditHrTeam: message.canEditHrTeam,
    timeZone: message.timeZone || 'Asia/Manila',
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
    salaryPeriod: PERIOD_TO_PROTO[row.salaryPeriod],
    status: STATUS_TO_PROTO[row.status],
    resumeRequired: row.resumeRequired,
    stages: row.stages.map(stageToProto),
    applicationFormId: row.applicationFormId,
    applicationFormName: row.applicationFormName,
    applicationFields: row.applicationFields.map(fieldToProto),
    scorecardFormId: row.scorecardFormId,
    scorecardFormName: row.scorecardFormName,
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
    salaryPeriod: PERIOD_FROM_PROTO[message.salaryPeriod],
    status: STATUS_FROM_PROTO[message.status],
    resumeRequired: message.resumeRequired,
    stages: message.stages.map(stageFromProto),
    applicationFormId: message.applicationFormId,
    applicationFormName: message.applicationFormName,
    applicationFields: message.applicationFields.map(fieldFromProto),
    scorecardFormId: message.scorecardFormId,
    scorecardFormName: message.scorecardFormName,
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
    salaryPeriod: PERIOD_TO_PROTO[draft.salaryPeriod],
    resumeRequired: draft.resumeRequired,
    stages: draft.stages.map(stageToProto),
    applicationFormId: draft.applicationFormId || undefined,
    scorecardFormId: draft.scorecardFormId || undefined,
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
    salaryPeriod: PERIOD_FROM_PROTO[request.salaryPeriod],
    resumeRequired: request.resumeRequired,
    stages: request.stages.map(stageFromProto),
    applicationFormId: request.applicationFormId ?? '',
    scorecardFormId: request.scorecardFormId ?? '',
    teamId: request.teamId ?? '',
    closesAt: request.closesAt ?? '',
  }
}

const APP_STATUS_TO_PROTO: Record<AppStatus, ApplicationStatus> = {
  active: ApplicationStatus.ACTIVE,
  hired: ApplicationStatus.HIRED,
  rejected: ApplicationStatus.REJECTED,
  withdrawn: ApplicationStatus.WITHDRAWN,
}

const APP_STATUS_FROM_PROTO: Record<ApplicationStatus, AppStatus> = {
  [ApplicationStatus.UNSPECIFIED]: 'active',
  [ApplicationStatus.ACTIVE]: 'active',
  [ApplicationStatus.HIRED]: 'hired',
  [ApplicationStatus.REJECTED]: 'rejected',
  [ApplicationStatus.WITHDRAWN]: 'withdrawn',
}

const APP_FILTER_TO_PROTO: Record<AppStatusFilter, ApplicationStatusFilter> = {
  active: ApplicationStatusFilter.ACTIVE,
  hired: ApplicationStatusFilter.HIRED,
  rejected: ApplicationStatusFilter.REJECTED,
  withdrawn: ApplicationStatusFilter.WITHDRAWN,
  all: ApplicationStatusFilter.ALL,
}

const APP_FILTER_FROM_PROTO: Record<ApplicationStatusFilter, AppStatusFilter> = {
  [ApplicationStatusFilter.UNSPECIFIED]: 'active',
  [ApplicationStatusFilter.ACTIVE]: 'active',
  [ApplicationStatusFilter.HIRED]: 'hired',
  [ApplicationStatusFilter.REJECTED]: 'rejected',
  [ApplicationStatusFilter.WITHDRAWN]: 'withdrawn',
  [ApplicationStatusFilter.ALL]: 'all',
}

export function applicationFilterToProto(status: AppStatusFilter) {
  return APP_FILTER_TO_PROTO[status]
}

export function applicationFilterFromProto(status: ApplicationStatusFilter) {
  return APP_FILTER_FROM_PROTO[status]
}

export function summaryToProto(row: ApplicationSummary): SummaryMessage {
  return {
    $typeName: 'ihp.hiring.v1.ApplicationSummary',
    id: row.id,
    postingId: row.postingId,
    postingTitle: row.postingTitle,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: APP_STATUS_TO_PROTO[row.status],
    stageId: row.stageId,
    stageName: row.stageName,
    stageChangedAt: row.stageChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasResume: row.hasResume,
  }
}

export function summaryFromProto(message: SummaryMessage): ApplicationSummary {
  return {
    id: message.id,
    postingId: message.postingId,
    postingTitle: message.postingTitle,
    fullName: message.fullName,
    email: message.email,
    phone: message.phone,
    status: APP_STATUS_FROM_PROTO[message.status],
    stageId: message.stageId,
    stageName: message.stageName,
    stageChangedAt: message.stageChangedAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    hasResume: message.hasResume,
  }
}

function fileToProto(file: ApplicationFile): FileMessage {
  return { $typeName: 'ihp.hiring.v1.ApplicationFile', ...file }
}

function fileFromProto(message: FileMessage): ApplicationFile {
  return {
    id: message.id,
    fieldId: message.fieldId,
    fileName: message.fileName,
    contentType: message.contentType,
    fileSize: message.fileSize,
  }
}

export function noteToProto(note: ApplicationNote): NoteMessage {
  return { $typeName: 'ihp.hiring.v1.ApplicationNote', ...note }
}

export function noteFromProto(message: NoteMessage): ApplicationNote {
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt,
    isMine: message.isMine,
  }
}

function eventToProto(event: ApplicationEventRow): EventMessage {
  return { $typeName: 'ihp.hiring.v1.ApplicationEvent', ...event }
}

function eventFromProto(message: EventMessage): ApplicationEventRow {
  return {
    id: message.id,
    label: message.label,
    actorName: message.actorName,
    detail: message.detail,
    createdAt: message.createdAt,
  }
}

export function applicationToProto(detail: ApplicationDetail): ApplicationMessage {
  return {
    $typeName: 'ihp.hiring.v1.Application',
    summary: summaryToProto(detail.summary),
    fields: detail.fields.map(fieldToProto),
    values: valuesToProto(detail.fields, detail.values),
    files: detail.files.map(fileToProto),
    notes: detail.notes.map(noteToProto),
    events: detail.events.map(eventToProto),
    stages: detail.stages.map(stageToProto),
    rejectionReason: detail.rejectionReason,
    postingSlug: detail.postingSlug,
    joined: detail.joined,
    invitationExpiresAt: detail.invitationExpiresAt,
    postingTeamId: detail.postingTeamId,
    interviews: detail.interviews.map(interviewToProto),
    scorecards: detail.scorecards.map(scorecardToProto),
    offers: detail.offers.map(offerToProto),
  }
}

export function applicationFromProto(message: ApplicationMessage): ApplicationDetail {
  if (!message.summary) throw new Error('The server did not return the application.')
  return {
    summary: summaryFromProto(message.summary),
    fields: message.fields.map(fieldFromProto),
    values: valuesFromProto(message.values),
    files: message.files.map(fileFromProto),
    notes: message.notes.map(noteFromProto),
    events: message.events.map(eventFromProto),
    stages: message.stages.map(stageFromProto),
    rejectionReason: message.rejectionReason,
    postingSlug: message.postingSlug,
    joined: message.joined,
    invitationExpiresAt: message.invitationExpiresAt,
    postingTeamId: message.postingTeamId,
    interviews: message.interviews.map(interviewFromProto),
    scorecards: message.scorecards.map(scorecardFromProto),
    offers: message.offers.map(offerFromProto),
  }
}

const OFFER_STATUS_TO_PROTO: Record<OfferState, OfferStatusEnum> = {
  sent: OfferStatusEnum.SENT,
  accepted: OfferStatusEnum.ACCEPTED,
  declined: OfferStatusEnum.DECLINED,
}

const OFFER_STATUS_FROM_PROTO: Record<OfferStatusEnum, OfferState> = {
  [OfferStatusEnum.UNSPECIFIED]: 'sent',
  [OfferStatusEnum.SENT]: 'sent',
  [OfferStatusEnum.ACCEPTED]: 'accepted',
  [OfferStatusEnum.DECLINED]: 'declined',
}

export function offerToProto(row: OfferRow): OfferMessage {
  return {
    $typeName: 'ihp.hiring.v1.Offer',
    id: row.id,
    status: OFFER_STATUS_TO_PROTO[row.status],
    message: row.message,
    fileName: row.fileName,
    fileSize: row.fileSize,
    declineReason: row.declineReason,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    createdByName: row.createdByName,
  }
}

export function offerFromProto(message: OfferMessage): OfferRow {
  return {
    id: message.id,
    status: OFFER_STATUS_FROM_PROTO[message.status],
    message: message.message,
    fileName: message.fileName,
    fileSize: message.fileSize,
    declineReason: message.declineReason,
    createdAt: message.createdAt,
    respondedAt: message.respondedAt,
    createdByName: message.createdByName,
  }
}

const FORMAT_TO_PROTO: Record<Format, InterviewFormat> = {
  video: InterviewFormat.VIDEO,
  onsite: InterviewFormat.ONSITE,
  phone: InterviewFormat.PHONE,
}

const FORMAT_FROM_PROTO: Record<InterviewFormat, Format> = {
  [InterviewFormat.UNSPECIFIED]: 'video',
  [InterviewFormat.VIDEO]: 'video',
  [InterviewFormat.ONSITE]: 'onsite',
  [InterviewFormat.PHONE]: 'phone',
}

const INTERVIEW_STATUS_TO_PROTO: Record<InterviewState, InterviewStatus> = {
  offered: InterviewStatus.OFFERED,
  booked: InterviewStatus.BOOKED,
  reschedule_requested: InterviewStatus.RESCHEDULE_REQUESTED,
  cancelled: InterviewStatus.CANCELLED,
}

const INTERVIEW_STATUS_FROM_PROTO: Record<InterviewStatus, InterviewState> = {
  [InterviewStatus.UNSPECIFIED]: 'offered',
  [InterviewStatus.OFFERED]: 'offered',
  [InterviewStatus.BOOKED]: 'booked',
  [InterviewStatus.RESCHEDULE_REQUESTED]: 'reschedule_requested',
  [InterviewStatus.CANCELLED]: 'cancelled',
}

export function interviewFormatToProto(format: Format) {
  return FORMAT_TO_PROTO[format]
}

export function interviewFormatFromProto(format: InterviewFormat) {
  return FORMAT_FROM_PROTO[format]
}

export function interviewerToProto(person: Interviewer): InterviewerMessage {
  return { $typeName: 'ihp.hiring.v1.Interviewer', ...person }
}

export function interviewerFromProto(message: InterviewerMessage): Interviewer {
  return { userId: message.userId, name: message.name, email: message.email }
}

export function interviewToProto(row: InterviewRow): InterviewMessage {
  return {
    $typeName: 'ihp.hiring.v1.Interview',
    id: row.id,
    applicationId: row.applicationId,
    format: FORMAT_TO_PROTO[row.format],
    location: row.location,
    note: row.note,
    durationMinutes: row.durationMinutes,
    interviewers: row.interviewers.map(interviewerToProto),
    status: INTERVIEW_STATUS_TO_PROTO[row.status],
    slots: row.slots.map((slot) => ({
      $typeName: 'ihp.hiring.v1.InterviewSlot' as const,
      ...slot,
    })),
    bookedStart: row.bookedStart,
    bookedEnd: row.bookedEnd,
    applicantTimeZone: row.applicantTimeZone,
    joinUrl: row.joinUrl,
    inCalendar: row.inCalendar,
    createdAt: row.createdAt,
  }
}

export function interviewFromProto(message: InterviewMessage): InterviewRow {
  return {
    id: message.id,
    applicationId: message.applicationId,
    format: FORMAT_FROM_PROTO[message.format],
    location: message.location,
    note: message.note,
    durationMinutes: message.durationMinutes,
    interviewers: message.interviewers.map(interviewerFromProto),
    status: INTERVIEW_STATUS_FROM_PROTO[message.status],
    slots: message.slots.map((slot) => ({ id: slot.id, start: slot.start, end: slot.end })),
    bookedStart: message.bookedStart,
    bookedEnd: message.bookedEnd,
    applicantTimeZone: message.applicantTimeZone,
    joinUrl: message.joinUrl,
    inCalendar: message.inCalendar,
    createdAt: message.createdAt,
  }
}

const RECOMMENDATION_TO_PROTO: Record<Recommendation, RecommendationEnum> = {
  strong_yes: RecommendationEnum.STRONG_YES,
  yes: RecommendationEnum.YES,
  no: RecommendationEnum.NO,
  strong_no: RecommendationEnum.STRONG_NO,
}

// UNSPECIFIED has no verdict to fall back on, so it reads as the empty string the server refuses.
const RECOMMENDATION_FROM_PROTO: Record<RecommendationEnum, Recommendation | ''> = {
  [RecommendationEnum.UNSPECIFIED]: '',
  [RecommendationEnum.STRONG_YES]: 'strong_yes',
  [RecommendationEnum.YES]: 'yes',
  [RecommendationEnum.NO]: 'no',
  [RecommendationEnum.STRONG_NO]: 'strong_no',
}

export function recommendationToProto(value: Recommendation) {
  return RECOMMENDATION_TO_PROTO[value]
}

export function recommendationFromProto(value: RecommendationEnum) {
  return RECOMMENDATION_FROM_PROTO[value]
}

export function scorecardToProto(row: ScorecardRow): ScorecardMessage {
  return {
    $typeName: 'ihp.hiring.v1.Scorecard',
    interviewId: row.interviewId,
    interviewerId: row.interviewerId,
    interviewerName: row.interviewerName,
    recommendation: RECOMMENDATION_TO_PROTO[row.recommendation],
    fields: row.fields.map(fieldToProto),
    values: valuesToProto(row.fields, row.values),
    updatedAt: row.updatedAt,
  }
}

export function scorecardFromProto(message: ScorecardMessage): ScorecardRow {
  return {
    interviewId: message.interviewId,
    interviewerId: message.interviewerId,
    interviewerName: message.interviewerName,
    recommendation: RECOMMENDATION_FROM_PROTO[message.recommendation] || 'no',
    fields: message.fields.map(fieldFromProto),
    values: valuesFromProto(message.values),
    updatedAt: message.updatedAt,
  }
}

export function interviewerViewToProto(view: InterviewerView): InterviewerViewMessage {
  return {
    $typeName: 'ihp.hiring.v1.InterviewerView',
    interview: interviewToProto(view.interview),
    applicant: summaryToProto(view.applicant),
    applicationFields: view.applicationFields.map(fieldToProto),
    applicationValues: valuesToProto(view.applicationFields, view.applicationValues),
    files: view.files.map((file) => ({
      $typeName: 'ihp.hiring.v1.ApplicationFile' as const,
      ...file,
    })),
    scorecardFields: view.scorecardFields.map(fieldToProto),
    mine: view.mine ? scorecardToProto(view.mine) : undefined,
    timeZone: view.timeZone,
    canScore: view.canScore,
  }
}

export function interviewerViewFromProto(message: InterviewerViewMessage): InterviewerView {
  if (!message.interview || !message.applicant)
    throw new Error('The server did not return the interview.')
  return {
    interview: interviewFromProto(message.interview),
    applicant: summaryFromProto(message.applicant),
    applicationFields: message.applicationFields.map(fieldFromProto),
    applicationValues: valuesFromProto(message.applicationValues),
    files: message.files.map((file) => ({
      id: file.id,
      fieldId: file.fieldId,
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.fileSize,
    })),
    scorecardFields: message.scorecardFields.map(fieldFromProto),
    mine: message.mine ? scorecardFromProto(message.mine) : undefined,
    timeZone: message.timeZone,
    canScore: message.canScore,
  }
}
