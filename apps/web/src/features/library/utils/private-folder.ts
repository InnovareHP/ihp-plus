import type { DriveItem } from '@ihp/graph'
import { pathFromRoot } from '@/features/drive/utils/mirror-path'
import { joinLibraryPath, librarySegments } from './library-path'

/** A root folder only owners and admins see; outside Clients/, so it never mirrors. */
export const EXECUTIVE_FOLDER = 'Executive'

// SharePoint names are case-insensitive, so `executive` is the same folder.
export function isExecutivePath(path: string) {
  return librarySegments(path)[0]?.toLowerCase() === EXECUTIVE_FOLDER.toLowerCase()
}

/** True for the Executive folder itself, whose rename or delete would expose or lose it. */
export function isExecutiveRoot(path: string) {
  return isExecutivePath(path) && librarySegments(path).length === 1
}

export function itemLibraryPath(item: DriveItem) {
  return joinLibraryPath(pathFromRoot(item) ?? '', item.name)
}
