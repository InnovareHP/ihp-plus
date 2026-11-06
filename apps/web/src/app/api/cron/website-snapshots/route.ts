import { NextResponse } from 'next/server'
import { sweepOldSnapshots } from '@/features/websites/service'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

// Catches the days no round ran, so no snapshot outlives the day it was taken.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  try {
    return NextResponse.json({ deleted: await sweepOldSnapshots() })
  } catch (error) {
    console.error('[cron] snapshot sweep failed', error)
    return NextResponse.json({ error: 'Could not clear old snapshots.' }, { status: 500 })
  }
}
