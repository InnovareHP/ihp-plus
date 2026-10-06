import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { requireHiringCaller } from './access'
import type { HiringReport, ReportQuery } from './schema'
import { stagesOf } from './utils/records'
import { funnelOf, outcomesOf, reportSince, type ReportApplication } from './utils/report'

function movedTo(detail: Prisma.JsonValue) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return undefined
  return typeof detail.toStageId === 'string' ? detail.toStageId : undefined
}

/** Counts applications by when they arrived, so each period is a cohort followed to its outcome. */
export async function loadHiringReport(
  query: ReportQuery,
  now = new Date(),
): Promise<HiringReport> {
  const caller = await requireHiringCaller()
  const since = reportSince(query.period, now)
  const arrived = since ? { gte: since } : undefined

  const postingRows = await db.jobPosting.findMany({
    where: { organizationId: caller.organizationId },
    select: { id: true, title: true, stages: true },
    orderBy: { createdAt: 'desc' },
  })
  const postingId = postingRows.some((posting) => posting.id === query.postingId)
    ? query.postingId
    : undefined

  const [applicationRows, offers] = await Promise.all([
    db.jobApplication.findMany({
      where: { organizationId: caller.organizationId, postingId, createdAt: arrived },
      select: {
        postingId: true,
        stageId: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        events: { where: { kind: 'moved' }, select: { detail: true } },
      },
    }),
    db.jobOffer.groupBy({
      by: ['status'],
      where: {
        organizationId: caller.organizationId,
        status: { in: ['accepted', 'declined'] },
        respondedAt: arrived,
        application: postingId ? { postingId } : undefined,
      },
      _count: { _all: true },
    }),
  ])

  const applications: ReportApplication[] = applicationRows.map((row) => ({
    postingId: row.postingId,
    stageId: row.stageId,
    status: row.status,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    movedTo: row.events.flatMap((event) => movedTo(event.detail) ?? []),
  }))
  const postings = postingRows.map((posting) => ({ ...posting, stages: stagesOf(posting.stages) }))
  const offerCount = (status: string) =>
    offers.find((row) => row.status === status)?._count._all ?? 0

  return {
    postingId,
    totals: outcomesOf(applications),
    offersAccepted: offerCount('accepted'),
    offersDeclined: offerCount('declined'),
    funnel: funnelOf(
      applications,
      postings.filter((posting) =>
        postingId
          ? posting.id === postingId
          : applications.some((row) => row.postingId === posting.id),
      ),
    ),
    postings: postings
      .map((posting) => ({
        id: posting.id,
        title: posting.title,
        ...outcomesOf(applications.filter((row) => row.postingId === posting.id)),
      }))
      .filter((row) => row.applications > 0)
      .sort((a, b) => b.applications - a.applications),
    postingOptions: postingRows.map((posting) => ({ value: posting.id, label: posting.title })),
  }
}
