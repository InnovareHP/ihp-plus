import { NextResponse } from 'next/server'
import { publicOfferLetterUrl } from '@/features/hiring/offer-service'
import { S3NotConfiguredError } from '@/lib/s3'

// The signature is the credential, so every answer is computed fresh and never cached.
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string; signature: string; offerId: string }> },
) {
  const { applicationId, signature, offerId } = await params

  try {
    const url = await publicOfferLetterUrl(applicationId, signature, offerId)
    if (!url) return NextResponse.json({ error: 'That letter is not available.' }, { status: 404 })
    return NextResponse.redirect(url, {
      status: 302,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    })
  } catch (error) {
    if (error instanceof S3NotConfiguredError) {
      return NextResponse.json({ error: 'File storage is not available.' }, { status: 503 })
    }
    throw error
  }
}
