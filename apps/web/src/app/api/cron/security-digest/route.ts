import { NextResponse } from 'next/server'
import { DIGEST_STEPS, runDigest, type DigestStep } from '@/features/security-digest/service'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

// Each organization's draft waits on the model, which can take most of a minute.
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const step = new URL(request.url).searchParams.get('step') ?? ''
  if (!(DIGEST_STEPS as readonly string[]).includes(step)) {
    return NextResponse.json({ error: 'Say which step: draft or send.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await runDigest(step as DigestStep))
  } catch (error) {
    console.error('[cron] security digest failed', error)
    return NextResponse.json({ error: 'Could not run the security emails.' }, { status: 500 })
  }
}
