import { db } from '@ihp/db'
import { OFFER_STATUSES, type OfferRow, type OfferStatus, type PublicOffer } from './schema'

export type OfferRecord = Awaited<ReturnType<typeof offerRecordsOf>>[number]

function statusOf(value: string): OfferStatus {
  return (OFFER_STATUSES as readonly string[]).includes(value) ? (value as OfferStatus) : 'sent'
}

export function offerRowOf(row: OfferRecord, names: Map<string, string>): OfferRow {
  return {
    id: row.id,
    status: statusOf(row.status),
    message: row.message,
    fileName: row.fileName ?? undefined,
    fileSize: row.fileSize ?? undefined,
    declineReason: row.declineReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString(),
    createdByName: names.get(row.createdById) ?? 'Removed account',
  }
}

export function publicOfferOf(row: OfferRecord): PublicOffer {
  return {
    id: row.id,
    status: statusOf(row.status),
    message: row.message,
    fileName: row.fileName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString(),
  }
}

export function offerRecordsOf(applicationId: string) {
  return db.jobOffer.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } })
}
