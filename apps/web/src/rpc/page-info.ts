import type { PageInfo } from '@/lib/pagination'

/** The wire message carries $typeName too; only these fields cross into the app's own type. */
export interface ProtoPageInfo {
  page: number
  pageSize: number
  total: number
  pageCount: number
  hasPrevious: boolean
  hasNext: boolean
}

// Every paged list decodes its page the same way, and a response without one is a broken
// server rather than an empty list.
export function pageInfoFromProto(pageInfo: ProtoPageInfo | undefined): PageInfo {
  if (!pageInfo) throw new Error('The server did not return page information.')

  return {
    page: pageInfo.page,
    pageSize: pageInfo.pageSize,
    total: pageInfo.total,
    pageCount: pageInfo.pageCount,
    hasPrevious: pageInfo.hasPrevious,
    hasNext: pageInfo.hasNext,
  }
}
