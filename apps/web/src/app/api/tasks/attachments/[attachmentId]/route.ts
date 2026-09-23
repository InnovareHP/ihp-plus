import { Code, ConnectError } from '@ihp/rpc'
import { NextResponse } from 'next/server'
import { attachmentDownloadUrl } from '@/features/tasks/service'
import { S3NotConfiguredError } from '@/lib/s3'

// Signed per request, never a cached answer: the whole point is a link that does not go stale.
export const dynamic = 'force-dynamic'

const STATUS: Partial<Record<Code, number>> = {
  [Code.Unauthenticated]: 401,
  [Code.PermissionDenied]: 403,
  [Code.NotFound]: 404,
  [Code.FailedPrecondition]: 403,
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params

  try {
    const url = await attachmentDownloadUrl(attachmentId)
    // A 302 the browser follows at once; no-store so no cache hands back yesterday's signature.
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof S3NotConfiguredError) {
      return NextResponse.json({ error: 'File storage is not available.' }, { status: 503 })
    }
    const connect = ConnectError.from(error)
    return NextResponse.json({ error: connect.rawMessage }, { status: STATUS[connect.code] ?? 500 })
  }
}
