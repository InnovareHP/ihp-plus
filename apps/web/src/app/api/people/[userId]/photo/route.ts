import { NextResponse } from 'next/server'
import { imageResponse } from '@/lib/image-response'
import { profilePhotoKey } from '@/lib/profile-photo'

// Answered per viewer, so nothing between the browser and Next may cache it for everyone.
export const dynamic = 'force-dynamic'

// A day of private caching is safe because every new photo arrives under a new versioned URL.
const MAX_AGE_SECONDS = 24 * 60 * 60

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const pending = new URL(request.url).searchParams.get('pending') ?? undefined

  const lookup = await profilePhotoKey(userId, pending)
  if (lookup.status !== 'ok') {
    return lookup.status === 'unauthenticated'
      ? NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
      : NextResponse.json({ error: 'That picture is no longer there.' }, { status: 404 })
  }

  // A pending upload can be replaced any second, so it is never cached.
  return imageResponse(lookup.key, pending ? 0 : MAX_AGE_SECONDS)
}
