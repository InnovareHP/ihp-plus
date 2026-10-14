import { NextResponse } from 'next/server'
import { submitEnquiry } from '@/features/contact/service'
import { clientIpOf } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// The marketing site is a separate origin in production; no cookies ride along, so any origin may post.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null)
  const { status, error } = await submitEnquiry(input, clientIpOf(request.headers))
  return NextResponse.json(error ? { error } : { ok: true }, { status, headers: CORS })
}
