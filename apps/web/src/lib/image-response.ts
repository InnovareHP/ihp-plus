import { NextResponse } from 'next/server'
import { getObject, S3NotConfiguredError } from '@/lib/s3'

// Only what the upload paths accept; anything else in the bucket is not served as a picture.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Streams a stored picture from our own domain. Private caching only: it is somebody's face, and
 * a shared cache must never hand it to the next person behind the same proxy.
 */
export async function imageResponse(key: string, maxAgeSeconds: number): Promise<Response> {
  try {
    const stored = await getObject(key)
    if (!stored || !IMAGE_TYPES.has(stored.contentType)) {
      return NextResponse.json({ error: 'That picture is no longer there.' }, { status: 404 })
    }
    return new Response(stored.body, {
      headers: {
        'Content-Type': stored.contentType,
        ...(stored.contentLength !== undefined
          ? { 'Content-Length': String(stored.contentLength) }
          : {}),
        'Cache-Control': `private, max-age=${maxAgeSeconds}`,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof S3NotConfiguredError) {
      return NextResponse.json({ error: 'File storage is not available.' }, { status: 503 })
    }
    throw error
  }
}
