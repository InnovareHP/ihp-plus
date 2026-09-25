import { Code, ConnectError } from '@ihp/rpc'
import { NextResponse } from 'next/server'
import { bulletinImageKey } from '@/features/bulletin/service'
import { imageResponse } from '@/lib/image-response'

// Answered per viewer, so nothing between the browser and Next may cache it for everyone.
export const dynamic = 'force-dynamic'

// A photo is never replaced under its id, so the browser may keep it for a day.
const MAX_AGE_SECONDS = 24 * 60 * 60

const STATUS: Partial<Record<Code, number>> = {
  [Code.Unauthenticated]: 401,
  [Code.PermissionDenied]: 403,
  [Code.FailedPrecondition]: 403,
  [Code.NotFound]: 404,
}

export async function GET(_request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params

  try {
    return await imageResponse(await bulletinImageKey(imageId), MAX_AGE_SECONDS)
  } catch (error) {
    const connect = ConnectError.from(error)
    return NextResponse.json({ error: connect.rawMessage }, { status: STATUS[connect.code] ?? 500 })
  }
}
