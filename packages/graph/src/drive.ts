import { GraphError, graphFetch, graphJson, graphVoid } from './client'
import type { DeltaPage, DriveItem } from './types'

/** Graph rejects a simple upload over 4 MB; anything larger needs an upload session. */
export const SIMPLE_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024
const COPY_POLL_INTERVAL_MS = 1000
const COPY_POLL_ATTEMPTS = 60

interface DeltaResponse {
  value: DriveItem[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

/**
 * One page of changes. A notification says only that something moved, so the caller replays
 * from its stored link and keeps the deltaLink the sweep ends with.
 */
export async function deltaPage(driveId: string, link?: string): Promise<DeltaPage> {
  const payload = link
    ? await graphJson<DeltaResponse>(link, { absolute: true })
    : await graphJson<DeltaResponse>(`/drives/${driveId}/root/delta`)

  return {
    items: payload.value,
    nextLink: payload['@odata.nextLink'],
    deltaLink: payload['@odata.deltaLink'],
  }
}

/** Walks every page of a sweep and returns the deltaLink to resume from. */
export async function deltaSweep(driveId: string, link?: string) {
  const items: DriveItem[] = []
  let page = await deltaPage(driveId, link)
  items.push(...page.items)

  while (page.nextLink) {
    page = await deltaPage(driveId, page.nextLink)
    items.push(...page.items)
  }

  return { items, deltaLink: page.deltaLink }
}

export function getItem(driveId: string, itemId: string) {
  return graphJson<DriveItem>(`/drives/${driveId}/items/${itemId}`)
}

export async function listChildren(driveId: string, itemId: string) {
  const payload = await graphJson<{ value: DriveItem[] }>(
    `/drives/${driveId}/items/${itemId}/children`,
  )
  return payload.value
}

function encodePath(path: string) {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

export function getItemByPath(driveId: string, path: string) {
  return graphJson<DriveItem>(`/drives/${driveId}/root:/${encodePath(path)}`)
}

/** Creates the folder, or returns the one already there — a mirror run repeats over the tree. */
export async function ensureFolder(driveId: string, parentItemId: string, name: string) {
  try {
    return await graphJson<DriveItem>(`/drives/${driveId}/items/${parentItemId}/children`, {
      method: 'POST',
      body: { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' },
    })
  } catch (error) {
    if (!(error instanceof GraphError) || !error.isConflict) throw error
    const children = await listChildren(driveId, parentItemId)
    const existing = children.find((child) => child.name === name && child.folder)
    if (!existing) throw error
    return existing
  }
}

export interface CopyTarget {
  driveId: string
  parentItemId: string
  name?: string
}

/** Returns the monitor URL: a copy is asynchronous even for a small file. */
export async function startCopy(driveId: string, itemId: string, target: CopyTarget) {
  const response = await graphFetch(`/drives/${driveId}/items/${itemId}/copy`, {
    method: 'POST',
    body: {
      parentReference: { driveId: target.driveId, id: target.parentItemId },
      ...(target.name ? { name: target.name } : {}),
    },
  })

  const monitorUrl = response.headers.get('location')
  if (!monitorUrl) throw new Error('Graph accepted the copy but returned no monitor URL.')
  return monitorUrl
}

interface CopyMonitor {
  status: string
  resourceId?: string
  error?: { code?: string; message?: string }
}

export async function waitForCopy(
  monitorUrl: string,
  { attempts = COPY_POLL_ATTEMPTS, intervalMs = COPY_POLL_INTERVAL_MS } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    // The monitor is pre-authenticated, so it is fetched without a Graph token.
    const response = await fetch(monitorUrl)
    const payload = (await response.json()) as CopyMonitor

    if (payload.status === 'completed' && payload.resourceId) return payload.resourceId
    if (payload.status === 'failed') {
      throw new Error(payload.error?.message ?? 'Graph reported the copy as failed.')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('The copy did not finish in time.')
}

export async function copyItem(driveId: string, itemId: string, target: CopyTarget) {
  return waitForCopy(await startCopy(driveId, itemId, target))
}

export function renameItem(driveId: string, itemId: string, name: string) {
  return graphJson<DriveItem>(`/drives/${driveId}/items/${itemId}`, {
    method: 'PATCH',
    body: { name },
  })
}

export function deleteItem(driveId: string, itemId: string) {
  return graphVoid(`/drives/${driveId}/items/${itemId}`, { method: 'DELETE' })
}

/** A short-lived URL the browser follows directly; Graph signs it, so it carries no token. */
export async function downloadUrl(driveId: string, itemId: string) {
  const item = await graphJson<DriveItem>(
    `/drives/${driveId}/items/${itemId}?select=id,@microsoft.graph.downloadUrl`,
  )
  const url = item['@microsoft.graph.downloadUrl']
  if (!url) throw new Error('That item has no download URL — it is probably a folder.')
  return url
}

export async function uploadSmallFile(
  driveId: string,
  parentItemId: string,
  name: string,
  body: Uint8Array,
  contentType: string,
) {
  if (body.byteLength > SIMPLE_UPLOAD_LIMIT_BYTES) {
    throw new Error('Files over 4 MB need createUploadSession, not a simple upload.')
  }

  const response = await graphFetch(
    `/drives/${driveId}/items/${parentItemId}:/${encodeURIComponent(name)}:/content`,
    { method: 'PUT', headers: { 'content-type': contentType }, rawBody: body },
  )
  return (await response.json()) as DriveItem
}

/** The resumable path for anything past 4 MB; the caller PUTs ranges to uploadUrl. */
export function createUploadSession(driveId: string, parentItemId: string, name: string) {
  return graphJson<{ uploadUrl: string; expirationDateTime: string }>(
    `/drives/${driveId}/items/${parentItemId}:/${encodeURIComponent(name)}:/createUploadSession`,
    { method: 'POST', body: { item: { '@microsoft.graph.conflictBehavior': 'replace' } } },
  )
}
