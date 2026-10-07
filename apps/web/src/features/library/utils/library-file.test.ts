import { describe, expect, it } from 'vitest'
import {
  contentDisposition,
  isPreviewableImage,
  libraryEntityTag,
  libraryFileUrl,
  matchesEntityTag,
  servesInline,
} from './library-file'

describe('libraryFileUrl', () => {
  it('points at our own origin and changes with the file', () => {
    const entry = { id: 'abc 1', lastModifiedAt: '2026-03-04T10:00:00Z' }

    expect(libraryFileUrl(entry)).toBe('/app/api/library/files/abc%201?v=2026-03-04T10%3A00%3A00Z')
    expect(libraryFileUrl(entry, 'thumbnail')).toContain('rendition=thumbnail')
    expect(libraryFileUrl(entry, 'original', { download: true })).toContain('download=1')
  })
})

describe('inline serving', () => {
  it('previews raster images but never SVG, which can carry script', () => {
    expect(isPreviewableImage('image/png')).toBe(true)
    expect(isPreviewableImage('image/svg+xml')).toBe(false)
    expect(isPreviewableImage(undefined)).toBe(false)
    expect(servesInline('application/pdf')).toBe(true)
    expect(servesInline('text/html')).toBe(false)
  })
})

describe('entity tags', () => {
  it('builds a quoted tag per rendition and matches it in a list', () => {
    const tag = libraryEntityTag('"c:{0A1B},3"', 'thumbnail')

    expect(tag).toBe('"c0A1B3-thumbnail"')
    expect(matchesEntityTag(`"other", W/${tag}`, tag)).toBe(true)
    expect(matchesEntityTag('"other"', tag)).toBe(false)
    expect(matchesEntityTag(null, tag)).toBe(false)
  })
})

describe('contentDisposition', () => {
  it('keeps the exact name for modern clients and an ASCII one for the rest', () => {
    expect(contentDisposition('Café "plan".pdf', false)).toBe(
      `attachment; filename="Caf_ _plan_.pdf"; filename*=UTF-8''Caf%C3%A9%20%22plan%22.pdf`,
    )
    expect(contentDisposition('a.png', true)).toMatch(/^inline;/)
  })
})
