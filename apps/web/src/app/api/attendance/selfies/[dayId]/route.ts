import { Code, ConnectError } from '@ihp/rpc'
import { NextResponse } from 'next/server'
import { selfieKeyFor } from '@/features/attendance/service'
import { imageResponse } from '@/lib/image-response'

// Answered per viewer, so nothing between the browser and Next may cache it for everyone.
export const dynamic = 'force-dynamic'

// A day's selfie is written once and never replaced, so a short private cache is plenty.
const MAX_AGE_SECONDS = 60 * 60

const STATUS: Partial<Record<Code, number>> = {
  [Code.Unauthenticated]: 401,
  [Code.PermissionDenied]: 403,
  [Code.FailedPrecondition]: 403,
  [Code.NotFound]: 404,
}

export async function GET(request: Request, { params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params
  const side = new URL(request.url).searchParams.get('side')
  if (side !== 'in' && side !== 'out') {
    return NextResponse.json({ error: 'Say which end of the day: in or out.' }, { status: 400 })
  }

  try {
    return await imageResponse(await selfieKeyFor(dayId, side), MAX_AGE_SECONDS)
  } catch (error) {
    const connect = ConnectError.from(error)
    return NextResponse.json({ error: connect.rawMessage }, { status: STATUS[connect.code] ?? 500 })
  }
}
