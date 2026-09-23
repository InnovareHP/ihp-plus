import { NextResponse } from 'next/server'
import { fillUpcomingHolidays } from '@/features/attendance/holiday-calendar'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  try {
    const added = await fillUpcomingHolidays()
    return NextResponse.json({ added })
  } catch (error) {
    console.error('[cron] filling the holiday calendar failed', error)
    return NextResponse.json({ error: 'Could not fill the holiday calendar.' }, { status: 500 })
  }
}
