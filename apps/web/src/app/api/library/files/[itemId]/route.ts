import { GraphError, GraphNotConfiguredError } from '@ihp/graph'
import { NextResponse } from 'next/server'
import { NotAFileError, readLibraryFile } from '@/features/library/service'
import {
  contentDisposition,
  libraryEntityTag,
  LIBRARY_RENDITIONS,
  matchesEntityTag,
  servesInline,
  type LibraryRendition,
} from '@/features/library/utils/library-file'
import { getSession, readProfile } from '@/lib/auth-guard'

// Answered per viewer, so nothing between the browser and Next may cache it for everyone.
export const dynamic = 'force-dynamic'

// The page links each file with its modified time, so a changed file arrives under a new URL.
const MAX_AGE_SECONDS = 24 * 60 * 60

function problem(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function renditionOf(value: string | null): LibraryRendition {
  return LIBRARY_RENDITIONS.find((rendition) => rendition === value) ?? 'original'
}

export async function GET(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await getSession()
  if (!session) return problem(401, 'Sign in to continue.')
  const profile = await readProfile(session.user.id)
  if (!profile?.onboardingCompletedAt) return problem(403, 'Finish onboarding to open files.')

  const { itemId } = await params
  const search = new URL(request.url).searchParams
  const rendition = renditionOf(search.get('rendition'))
  const forceDownload = search.get('download') === '1'

  try {
    const { item, open } = await readLibraryFile(itemId)
    const tag = item.cTag ? libraryEntityTag(item.cTag, rendition) : undefined
    const caching = {
      'Cache-Control': `private, max-age=${MAX_AGE_SECONDS}`,
      ...(tag ? { ETag: tag } : {}),
    }

    if (tag && matchesEntityTag(request.headers.get('if-none-match'), tag)) {
      return new Response(null, { status: 304, headers: caching })
    }

    const upstream = await open(rendition)
    // A thumbnail is always a JPEG Graph renders, whatever the original was.
    const contentType =
      rendition === 'original'
        ? (item.file?.mimeType ?? 'application/octet-stream')
        : (upstream.headers.get('content-type') ?? 'image/jpeg')
    const length = upstream.headers.get('content-length')

    return new Response(upstream.body, {
      headers: {
        ...caching,
        'Content-Type': contentType,
        ...(length ? { 'Content-Length': length } : {}),
        'Content-Disposition': contentDisposition(
          item.name,
          !forceDownload && servesInline(contentType),
        ),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof GraphNotConfiguredError) {
      return problem(503, 'The internal library is not connected yet.')
    }
    if (error instanceof NotAFileError) return problem(404, 'That is a folder, not a file.')
    if (error instanceof GraphError) {
      if (error.isNotFound) return problem(404, 'That file is no longer in the internal library.')
      return problem(502, 'SharePoint did not answer — try again in a moment.')
    }
    throw error
  }
}
