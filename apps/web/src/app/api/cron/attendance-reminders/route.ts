import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sendDueReminders } from '@/features/attendance/reminders'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

// Vercel Cron sends CRON_SECRET as a bearer token; with no secret set, nothing may trigger it.
function authorized(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  try {
    const sent = await sendDueReminders()
    return NextResponse.json({ sent })
  } catch (error) {
    console.error('[cron] attendance reminders failed', error)
    return NextResponse.json({ error: 'Could not send reminders.' }, { status: 500 })
  }
}
