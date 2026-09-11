export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export type PhotoType = keyof typeof TYPES

export const ACCEPTED_PHOTO_TYPES = Object.keys(TYPES).join(',')

export function photoExtension(type: PhotoType) {
  return TYPES[type]
}

function matches(bytes: Uint8Array, offset: number, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

// A browser-supplied content type is a claim, so the bucket only ever sees a sniffed one.
export function detectPhotoType(bytes: Uint8Array): PhotoType | null {
  if (matches(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (matches(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return 'image/webp'
  }
  return null
}
