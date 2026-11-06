import { NextResponse } from 'next/server'
import {
  EXPIRY_EMAIL_KINDS,
  runExpiryEmails,
  type ExpiryEmailKind,
} from '@/features/websites/expiry-emails'
import { isAuthorizedCron } from '@/lib/cron'

// A cron target, never a cached answer.
export const dynamic = 'force-dynamic'

// Every site's registry and certificate are read inside the request.
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const kind = new URL(request.url).searchParams.get('kind') ?? ''
  if (!(EXPIRY_EMAIL_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: 'Say which run: monthly or alerts.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await runExpiryEmails(kind as ExpiryEmailKind))
  } catch (error) {
    console.error('[cron] website domain and SSL emails failed', error)
    return NextResponse.json(
      { error: 'Could not send the domain and SSL emails.' },
      { status: 500 },
    )
  }
}
