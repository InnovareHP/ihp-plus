import { describe, expect, it } from 'vitest'
import { detectPhotoType, photoExtension } from './photo'

function bytes(...values: number[]) {
  return new Uint8Array([...values, ...Array.from({ length: 16 }, () => 0)])
}

describe('detectPhotoType', () => {
  it('recognises the three accepted formats by their signature', () => {
    expect(detectPhotoType(bytes(0xff, 0xd8, 0xff))).toBe('image/jpeg')
    expect(detectPhotoType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(
      detectPhotoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe('image/webp')
  })

  it('rejects a file whose claimed type is a lie', () => {
    // A PDF renamed to .png, which is exactly what a content-type header cannot catch.
    expect(detectPhotoType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull()
  })

  it('rejects a RIFF container that is not WebP', () => {
    expect(
      detectPhotoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20])),
    ).toBeNull()
  })

  it('rejects a truncated file', () => {
    expect(detectPhotoType(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })

  it('maps each type to the extension used in the object key', () => {
    expect(photoExtension('image/jpeg')).toBe('jpg')
    expect(photoExtension('image/webp')).toBe('webp')
  })
})
