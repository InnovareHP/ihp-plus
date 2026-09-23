import { withBasePath } from '@/lib/routes'
import { isObjectStorageConfigured } from '@/lib/s3'

/** A clock selfie on our own domain, so the link in a timesheet never expires under an admin. */
export function selfieUrl(dayId: string, side: 'in' | 'out', key: string | null) {
  if (!key || !isObjectStorageConfigured()) return undefined
  return withBasePath(`/api/attendance/selfies/${encodeURIComponent(dayId)}?side=${side}`)
}
