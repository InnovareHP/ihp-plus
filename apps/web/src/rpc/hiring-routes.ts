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
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import {
  draftFromProto,
  postingFilterFromProto,
  postingStatusFromProto,
  postingToProto,
  settingsToProto,
  stageFromProto,
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
}
