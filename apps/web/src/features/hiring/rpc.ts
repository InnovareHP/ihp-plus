'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import {
  applicationFilterToProto,
  applicationFromProto,
  draftToProto,
  noteFromProto,
  postingFilterToProto,
  postingFromProto,
  postingStatusToProto,
  settingsFromProto,
  stageToProto,
  summaryFromProto,
} from '@/rpc/hiring-codec'
import { pageInfoFromProto } from '@/rpc/page-info'
import type {
  ApplicationDetail,
  ApplicationNote,
  ApplicationQuery,
  ApplicationsPage,
  ApplicationSummary,
  HiringSettings,
  MoveValues,
  NoteValues,
  RejectValues,
  HiringSettingsValues,
  PostingDraftValues,
  PostingQuery,
  PostingRow,
  PostingsPage,
  PostingStatus,
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

function requiredPosting(posting: Parameters<typeof postingFromProto>[0] | undefined): PostingRow {
  if (!posting) throw new Error('The server did not return the posting.')
  return postingFromProto(posting)
}

function requiredSettings(
  settings: Parameters<typeof settingsFromProto>[0] | undefined,
): HiringSettings {
  if (!settings) throw new Error('The server did not return the hiring settings.')
  return settingsFromProto(settings)
}

export async function getSettings(): Promise<HiringSettings> {
  const response = await call(() => browserClients.hiring.getSettings({}))
  return requiredSettings(response.settings)
}

export async function saveSettings(values: HiringSettingsValues): Promise<HiringSettings> {
  const response = await call(() =>
    browserClients.hiring.saveSettings({
      hrTeamId: values.hrTeamId || undefined,
      defaultStages: values.defaultStages.map(stageToProto),
      rejectionMessage: values.rejectionMessage,
    }),
  )
  return requiredSettings(response.settings)
}

export async function listPostings(query: PostingQuery): Promise<PostingsPage> {
  const response = await call(() =>
    browserClients.hiring.listPostings({
      status: postingFilterToProto(query.status),
      search: query.search,
      teamIds: [...query.teamIds],
      page: query.page,
      pageSize: query.pageSize,
    }),
  )
  return {
    rows: response.rows.map(postingFromProto),
    pageInfo: pageInfoFromProto(response.pageInfo),
  }
}

export async function getPosting(postingId: string): Promise<PostingRow> {
  const response = await call(() => browserClients.hiring.getPosting({ postingId }))
  return requiredPosting(response.posting)
}

export async function savePosting(draft: PostingDraftValues): Promise<PostingRow> {
  const response = await call(() => browserClients.hiring.savePosting(draftToProto(draft)))
  return requiredPosting(response.posting)
}

export async function setPostingStatus(values: {
  postingId: string
  status: PostingStatus
}): Promise<PostingRow> {
  const response = await call(() =>
    browserClients.hiring.setPostingStatus({
      postingId: values.postingId,
      status: postingStatusToProto(values.status),
    }),
  )
  return requiredPosting(response.posting)
}

export async function deletePosting(postingId: string): Promise<void> {
  await call(() => browserClients.hiring.deletePosting({ postingId }))
}

function requiredSummary(
  summary: Parameters<typeof summaryFromProto>[0] | undefined,
): ApplicationSummary {
  if (!summary) throw new Error('The server did not return the application.')
  return summaryFromProto(summary)
}

export async function listApplications(query: ApplicationQuery): Promise<ApplicationsPage> {
  const response = await call(() =>
    browserClients.hiring.listApplications({
      postingId: query.postingId || undefined,
      status: applicationFilterToProto(query.status),
      stageId: query.stageId || undefined,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    }),
  )
  return {
    rows: response.rows.map(summaryFromProto),
    pageInfo: pageInfoFromProto(response.pageInfo),
  }
}

export async function listPipeline(postingId: string): Promise<ApplicationSummary[]> {
  const response = await call(() => browserClients.hiring.listPipeline({ postingId }))
  return response.rows.map(summaryFromProto)
}

export async function getApplication(applicationId: string): Promise<ApplicationDetail> {
  const response = await call(() => browserClients.hiring.getApplication({ applicationId }))
  if (!response.application) throw new Error('The server did not return the application.')
  return applicationFromProto(response.application)
}

export async function moveApplication(values: MoveValues): Promise<ApplicationSummary> {
  const response = await call(() =>
    browserClients.hiring.moveApplication({
      applicationId: values.applicationId,
      stageId: values.stageId,
      sendEmail: values.sendEmail,
      message: values.message || undefined,
    }),
  )
  return requiredSummary(response.application)
}

export async function rejectApplication(values: RejectValues): Promise<ApplicationSummary> {
  const response = await call(() => browserClients.hiring.rejectApplication(values))
  return requiredSummary(response.application)
}

export async function reopenApplication(applicationId: string): Promise<ApplicationSummary> {
  const response = await call(() => browserClients.hiring.reopenApplication({ applicationId }))
  return requiredSummary(response.application)
}

export async function addNote(values: NoteValues): Promise<ApplicationNote> {
  const response = await call(() => browserClients.hiring.addNote(values))
  if (!response.note) throw new Error('The server did not return the note.')
  return noteFromProto(response.note)
}

export async function deleteNote(noteId: string): Promise<void> {
  await call(() => browserClients.hiring.deleteNote({ noteId }))
}
