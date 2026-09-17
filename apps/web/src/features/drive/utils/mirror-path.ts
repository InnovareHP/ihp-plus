import type { DriveItem } from '@ihp/graph'
import { CLIENTS_ROOT } from '../schema'

/** What a mirrored item is: the client folder it belongs to and where it sits inside it. */
export interface MirrorTarget {
  clientFolder: string
  /** Path under the client's folder in the client library, '' for the folder itself. */
  relativePath: string
}

/** The OneDrive sync client leaves these behind; copying them out would confuse a client. */
export function isSyncJunk(name: string) {
  return (
    name.startsWith('~$') ||
    name.startsWith('.~') ||
    name.endsWith('.tmp') ||
    name.endsWith('.laccdb') ||
    /conflicted copy/i.test(name) ||
    name === '.DS_Store'
  )
}

/** Graph reports a parent as `/drive/root:/Clients/Acme/Shared`; this is the part after the colon. */
export function pathFromRoot(item: DriveItem) {
  const raw = item.parentReference?.path
  if (!raw) return undefined
  const marker = raw.indexOf('root:')
  const path = marker === -1 ? raw : raw.slice(marker + 'root:'.length)
  return decodeURI(path).replace(/^\/+/, '')
}

/**
 * Decides whether one item is client-visible. The rule is the folder it sits in, not a metadata
 * column: the sync client shows staff folders in Explorer and no SharePoint columns at all.
 */
export function mirrorTargetOf(item: DriveItem): MirrorTarget | null {
  if (isSyncJunk(item.name)) return null

  const parentPath = pathFromRoot(item)
  if (parentPath === undefined) return null

  const segments = [...parentPath.split('/').filter(Boolean), item.name]
  const [root, clientFolder, ...rest] = segments

  // The whole client folder travels; `Clients/Acme` itself is the client's root, not a copy.
  if (root !== CLIENTS_ROOT || !clientFolder) return null
  if (rest.some(isSyncJunk)) return null

  return { clientFolder, relativePath: rest.join('/') }
}

/** The folder segments to create under the client's folder before an item can land. */
export function parentSegmentsOf(target: MirrorTarget) {
  return target.relativePath.split('/').filter(Boolean).slice(0, -1)
}

export function isFolder(item: DriveItem) {
  return item.folder !== undefined
}

export function isRemoved(item: DriveItem) {
  return item.deleted !== undefined
}
