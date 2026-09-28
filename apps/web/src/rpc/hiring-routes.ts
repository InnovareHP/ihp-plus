import type { ServiceImpl } from '@ihp/rpc'
import { HiringService } from '@ihp/rpc/hiring'
import {
  deletePosting,
  loadPosting,
  loadPostingsPage,
  loadSettings,
  savePosting,
  saveSettings,
  setPostingStatus,
} from '@/features/hiring/service'
import {
  addNote,
  deleteNote,
  loadApplication,
  loadApplicationsPage,
  loadPipeline,
  moveApplication,
  rejectApplication,
  reopenApplication,
} from '@/features/hiring/pipeline-service'
import { hireApplication } from '@/features/hiring/hire-service'
import {
  cancelInterview,
  listInterviewers,
  offerInterview,
} from '@/features/hiring/interview-service'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import {
  applicationFilterFromProto,
  applicationToProto,
  interviewFormatFromProto,
  interviewerToProto,
  draftFromProto,
  noteToProto,
  postingFilterFromProto,
  postingStatusFromProto,
  postingToProto,
  settingsToProto,
  stageFromProto,
  summaryToProto,
} from './hiring-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const hiring: ServiceImpl<typeof HiringService> = {
  getSettings: async () => ({ settings: settingsToProto(await loadSettings()) }),

  saveSettings: async (request) => ({
    settings: settingsToProto(
      await saveSettings({
        hrTeamId: request.hrTeamId ?? '',
        defaultStages: request.defaultStages.map(stageFromProto),
        rejectionMessage: request.rejectionMessage,
        timeZone: request.timeZone || 'Asia/Manila',
      }),
    ),
  }),

  listPostings: async (request) => {
    const page = await loadPostingsPage({
      status: postingFilterFromProto(request.status),
      search: request.search,
      teamIds: request.teamIds,
      page: request.page || 1,
      pageSize: request.pageSize || DEFAULT_PAGE_SIZE,
    })

    return {
      rows: page.rows.map(postingToProto),
      pageInfo: { $typeName: 'ihp.requests.v1.PageInfo', ...page.pageInfo },
    }
  },

  getPosting: async (request) => ({
    posting: postingToProto(await loadPosting(request.postingId)),
  }),

  savePosting: async (request) => ({
    posting: postingToProto(await savePosting(draftFromProto(request))),
  }),

  setPostingStatus: async (request) => ({
    posting: postingToProto(
      await setPostingStatus({
        postingId: request.postingId,
        status: postingStatusFromProto(request.status),
      }),
    ),
  }),

  deletePosting: async (request) => {
    await deletePosting(request.postingId)
    return {}
  },

  listApplications: async (request) => {
    const page = await loadApplicationsPage({
      postingId: request.postingId ?? '',
      status: applicationFilterFromProto(request.status),
      stageId: request.stageId ?? '',
      search: request.search,
      page: request.page || 1,
      pageSize: request.pageSize || DEFAULT_PAGE_SIZE,
    })

    return {
      rows: page.rows.map(summaryToProto),
      pageInfo: { $typeName: 'ihp.requests.v1.PageInfo', ...page.pageInfo },
    }
  },

  listPipeline: async (request) => ({
    rows: (await loadPipeline(request.postingId)).map(summaryToProto),
  }),

  getApplication: async (request) => ({
    application: applicationToProto(await loadApplication(request.applicationId)),
  }),

  moveApplication: async (request) => ({
    application: summaryToProto(
      await moveApplication({
        applicationId: request.applicationId,
        stageId: request.stageId,
        sendEmail: request.sendEmail,
        message: request.message ?? '',
      }),
    ),
  }),

  rejectApplication: async (request) => ({
    application: summaryToProto(
      await rejectApplication({
        applicationId: request.applicationId,
        reason: request.reason,
        sendEmail: request.sendEmail,
        message: request.message,
      }),
    ),
  }),

  reopenApplication: async (request) => ({
    application: summaryToProto(await reopenApplication(request.applicationId)),
  }),

  addNote: async (request) => ({
    note: noteToProto(await addNote({ applicationId: request.applicationId, body: request.body })),
  }),

  deleteNote: async (request) => {
    await deleteNote(request.noteId)
    return {}
  },

  hireApplication: async (request) => ({
    application: applicationToProto(
      await hireApplication({
        applicationId: request.applicationId,
        teamId: request.teamId ?? '',
      }),
    ),
  }),

  listInterviewers: async () => ({
    people: (await listInterviewers()).map(interviewerToProto),
  }),

  // Free/busy needs Graph, which the next step wires; until then the dialog is told why it has none.
  suggestSlots: async () => ({ slots: [], fromCalendar: false }),

  offerInterview: async (request) => ({
    application: applicationToProto(
      await offerInterview({
        applicationId: request.applicationId,
        format: interviewFormatFromProto(request.format),
        location: request.location,
        note: request.note,
        durationMinutes: request.durationMinutes,
        interviewerIds: request.interviewerIds,
        starts: request.slots.map((slot) => slot.start),
      }),
    ),
  }),

  cancelInterview: async (request) => ({
    application: applicationToProto(await cancelInterview(request.interviewId)),
  }),
}
