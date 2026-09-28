import { NextResponse } from 'next/server'
import { sweepHiringData } from '@/features/hiring/retention'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  try {
    const swept = await sweepHiringData()
    return NextResponse.json(swept)
  } catch (error) {
    console.error('[cron] hiring retention sweep failed', error)
    return NextResponse.json({ error: 'Could not clear old hiring data.' }, { status: 500 })
  }
}
