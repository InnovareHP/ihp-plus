import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { CHECK_ROUNDS, dateKeySchema } from '@/features/websites/schema'
import { sweepOldSnapshots } from '@/features/websites/service'
import { captureSnapshots } from '@/features/websites/snapshot'
import { isAuthorizedCron } from '@/lib/cron'

// A hand-off target, never a cached answer.
export const dynamic = 'force-dynamic'

// Launching Chromium and opening five slow sites three at a time can take a couple of minutes.
export const maxDuration = 300

const captureJobSchema = z.object({
  organizationId: z.string().min(1),
  dateKey: dateKeySchema,
  round: z.enum(CHECK_ROUNDS),
  websiteIds: z.array(z.string().min(1)).min(1).max(10),
})

export async function POST(request: Request) {
  // Only our own server hands work here, with the same secret the scheduler uses.
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const parsed = captureJobSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Say which sites, round and day.' }, { status: 400 })
  }

  // Answered at once so the caller is not billed for waiting on the browser.
  after(async () => {
    try {
      const summary = await captureSnapshots(parsed.data)
      if (summary.failed > 0) {
        console.error(`[websites] ${summary.failed} of a batch's snapshots failed`)
      }
    } catch (error) {
      console.error('[websites] snapshot batch failed', error)
    }
    try {
      await sweepOldSnapshots(parsed.data.organizationId)
    } catch (error) {
      // The daily sweep catches whatever this one missed.
      console.error('[websites] could not sweep old snapshots', error)
    }
  })
  return NextResponse.json({ accepted: parsed.data.websiteIds.length }, { status: 202 })
}
