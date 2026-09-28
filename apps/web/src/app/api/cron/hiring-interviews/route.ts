import { NextResponse } from 'next/server'
import { sendInterviewReminders } from '@/features/hiring/interview-reminders'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  try {
    const sent = await sendInterviewReminders()
    return NextResponse.json(sent)
  } catch (error) {
    console.error('[cron] interview reminders failed', error)
    return NextResponse.json({ error: 'Could not send interview reminders.' }, { status: 500 })
  }
}
