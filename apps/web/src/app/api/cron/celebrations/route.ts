import { NextResponse } from 'next/server'
import { postCelebrations } from '@/features/bulletin/celebrations'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  try {
    const posted = await postCelebrations()
    return NextResponse.json({ posted })
  } catch (error) {
    console.error('[cron] bulletin celebrations failed', error)
    return NextResponse.json({ error: 'Could not post celebrations.' }, { status: 500 })
  }
}
