import { withBasePath } from '@/lib/routes'

/** A photo's permanent link on our own domain; a plain src, so basePath is written in here. */
export function bulletinImageUrl(imageId: string) {
  return withBasePath(`/api/bulletin/images/${encodeURIComponent(imageId)}`)
}
