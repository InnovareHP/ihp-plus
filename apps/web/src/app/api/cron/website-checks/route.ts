import { NextResponse } from 'next/server'
import { CHECK_ROUNDS, type CheckRound } from '@/features/websites/schema'
import { runWeekendChecks } from '@/features/websites/weekend'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

// Every site is opened inside the request, and a slow one waits out its 15 s timeout.
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const round = new URL(request.url).searchParams.get('round') ?? ''
  if (!(CHECK_ROUNDS as readonly string[]).includes(round)) {
    return NextResponse.json({ error: 'Say which round: clock_in or clock_out.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await runWeekendChecks(round as CheckRound))
  } catch (error) {
    console.error('[cron] weekend website checks failed', error)
    return NextResponse.json({ error: 'Could not run the website checks.' }, { status: 500 })
  }
}
