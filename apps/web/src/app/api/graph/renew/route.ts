import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { renewDriveSubscriptions } from '@/features/drive/subscription'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

/**
 * There is no worker process in this repo, so renewal is a route an external scheduler calls
 * daily — a Graph drive subscription lapses after 4230 minutes and takes the mirror with it.
 */
function authorized(request: Request) {
  const expected = process.env.GRAPH_CRON_SECRET
  if (!expected) return false

  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const result = await renewDriveSubscriptions()
  return NextResponse.json(result, { status: result.failed.length > 0 ? 207 : 200 })
}
