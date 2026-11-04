import { NextResponse } from 'next/server'
import { renewDriveSubscriptions } from '@/features/drive/subscription'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  try {
    const result = await renewDriveSubscriptions()
    return NextResponse.json(result, { status: result.failed.length > 0 ? 207 : 200 })
  } catch (error) {
    console.error('[cron] renewing Graph drive subscriptions failed', error)
    return NextResponse.json({ error: 'Could not renew the drive subscriptions.' }, { status: 500 })
  }
}
