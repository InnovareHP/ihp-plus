import { withBasePath } from '@/lib/routes'

export const LIBRARY_RENDITIONS = ['original', 'thumbnail', 'preview'] as const

export type LibraryRendition = (typeof LIBRARY_RENDITIONS)[number]

// Raster formats a browser draws itself; SVG is left out because it can carry script.
const PREVIEWABLE_IMAGES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
])

// Served on our own origin, so anything a browser could execute is downloaded, never rendered.
const INLINE_TYPES = new Set([...PREVIEWABLE_IMAGES, 'application/pdf'])

export function isPreviewableImage(contentType: string | undefined) {
  return contentType !== undefined && PREVIEWABLE_IMAGES.has(contentType)
}

export function servesInline(contentType: string) {
  return INLINE_TYPES.has(contentType)
}

/** Our own URL for a file; the version changes with the file, so the browser may keep it long. */
export function libraryFileUrl(
  entry: { id: string; lastModifiedAt: string | undefined },
  rendition: LibraryRendition = 'original',
  options: { download?: boolean } = {},
) {
  const params = new URLSearchParams()
  if (rendition !== 'original') params.set('rendition', rendition)
  if (options.download) params.set('download', '1')
  if (entry.lastModifiedAt) params.set('v', entry.lastModifiedAt)
  const search = params.toString()
  return withBasePath(
    `/api/library/files/${encodeURIComponent(entry.id)}${search ? `?${search}` : ''}`,
  )
}

/** Graph's cTag changes whenever the bytes do; it is stripped to characters an ETag can hold. */
export function libraryEntityTag(cTag: string, rendition: LibraryRendition) {
  return `"${cTag.replace(/[^\w-]/g, '')}-${rendition}"`
}

export function matchesEntityTag(ifNoneMatch: string | null, tag: string) {
  if (!ifNoneMatch) return false
  return ifNoneMatch
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .some((candidate) => candidate === tag || candidate === '*')
}

/** RFC 6266: an ASCII fallback for old clients and the exact name for everyone else. */
export function contentDisposition(name: string, inline: boolean) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}
