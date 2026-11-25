import { NextResponse } from 'next/server'
import { MAX_SAVE_DAYS, saveNetlifyDays } from '@/features/website-analytics/save'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

// The 89-day backfill reads every site's rankings day by day.
export const maxDuration = 300

const NIGHTLY_DAYS = 2

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const asked = new URL(request.url).searchParams.get('days')
  const days = asked === null ? NIGHTLY_DAYS : Number(asked)
  if (!Number.isInteger(days) || days < 1 || days > MAX_SAVE_DAYS) {
    return NextResponse.json({ error: `Ask for 1 to ${MAX_SAVE_DAYS} days.` }, { status: 400 })
  }

  if (!process.env.NETLIFY_API_TOKEN) {
    return NextResponse.json({ error: 'NETLIFY_API_TOKEN is not set.' }, { status: 503 })
  }

  try {
    const summary = await saveNetlifyDays(days)
    const allFailed = summary.sites > 0 && summary.failed.length === summary.sites
    return NextResponse.json(summary, { status: allFailed ? 502 : 200 })
  } catch (error) {
    console.error('[cron] website analytics save failed', error)
    return NextResponse.json({ error: 'Could not save the Netlify analytics.' }, { status: 500 })
  }
}
