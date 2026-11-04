import { NextResponse } from 'next/server'
import { websitesAccess } from '@/features/websites/access'
import { CHECK_ROUNDS, type CheckRound } from '@/features/websites/schema'
import { todaysSnapshotKey } from '@/features/websites/service'
import { SNAPSHOT_SIZES, type SnapshotSize } from '@/features/websites/utils/snapshot-key'
import { imageResponse } from '@/lib/image-response'

// Answered per viewer, so nothing between the browser and Next may cache it for everyone.
export const dynamic = 'force-dynamic'

// The link carries the capture time, so a recheck changes the URL and this never goes stale.
const MAX_AGE_SECONDS = 24 * 60 * 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string; round: string }> },
) {
  const { websiteId, round } = await params
  const size = new URL(request.url).searchParams.get('size') ?? 'thumb'
  if (!(CHECK_ROUNDS as readonly string[]).includes(round)) {
    return NextResponse.json({ error: 'Say which round: clock_in or clock_out.' }, { status: 400 })
  }
  if (!(SNAPSHOT_SIZES as readonly string[]).includes(size)) {
    return NextResponse.json({ error: 'Say which size: thumb or full.' }, { status: 400 })
  }

  const access = await websitesAccess()
  // Same answer as a missing picture: someone outside IT should not learn the screen exists.
  if (!access.canView || !access.organizationId) {
    return NextResponse.json({ error: 'That picture is no longer there.' }, { status: 404 })
  }

  const key = await todaysSnapshotKey(
    access.organizationId,
    websiteId,
    round as CheckRound,
    size as SnapshotSize,
  )
  if (!key) {
    return NextResponse.json({ error: 'That picture is no longer there.' }, { status: 404 })
  }
  return imageResponse(key, MAX_AGE_SECONDS)
}
