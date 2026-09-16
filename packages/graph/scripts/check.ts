/**
 * Proves the Graph setup end to end before any feature depends on it:
 *   pnpm graph:check
 * Every step prints the Graph error code on failure, because "it does not work" and
 * "the admin granted read but not write" need different people to fix them.
 */
import { GraphError, graphJson } from '../src/client'
import { isGraphConfigured, readGraphConfig } from '../src/config'
import { deleteItem, ensureFolder, rootItem } from '../src/drive'
import { createLink, listPermissions } from '../src/sharing'
import { getAccessToken } from '../src/token'
import type { DriveItem } from '../src/types'

const PROBE_FOLDER = '_ihp-graph-check'

let failed = false

function pass(step: string, detail?: string) {
  console.log(`  ok    ${step}${detail ? ` — ${detail}` : ''}`)
}

function fail(step: string, error: unknown) {
  failed = true
  const reason =
    error instanceof GraphError
      ? `${error.code} (HTTP ${error.status})${error.requestId ? `, request ${error.requestId}` : ''}`
      : error instanceof Error
        ? error.message
        : String(error)
  console.log(`  FAIL  ${step} — ${reason}`)
}

async function step<T>(name: string, run: () => Promise<T>, describe?: (value: T) => string) {
  try {
    const value = await run()
    pass(name, describe?.(value))
    return value
  } catch (error) {
    fail(name, error)
    return undefined
  }
}

async function checkDrive(label: string, driveId: string) {
  console.log(`\n${label} (${driveId})`)
  const drive = await step(
    'read the library',
    () => graphJson<{ name?: string; webUrl?: string }>(`/drives/${driveId}`),
    (value) => value.webUrl ?? value.name ?? 'no name',
  )
  if (!drive) return undefined

  return step(
    'read its root',
    () => rootItem(driveId),
    (root) => `item ${root.id}`,
  )
}

async function checkWrite(driveId: string, root: DriveItem) {
  const folder = await step(
    'create a folder (proves the write grant)',
    () => ensureFolder(driveId, root.id, PROBE_FOLDER),
    (value) => `item ${value.id}`,
  )
  if (!folder) return

  // The open question from the plan: Sites.Selected is not documented for sharing calls.
  await step(
    'read permissions on it',
    () => listPermissions(driveId, folder.id),
    (permissions) => `${permissions.length} already set`,
  )
  await step(
    'create a sharing link (proves Sites.Selected covers sharing)',
    () => createLink(driveId, folder.id, { type: 'view', scope: 'organization' }),
    (permission) => permission.link?.webUrl ?? 'link created',
  )

  await step('clean up the probe folder', () => deleteItem(driveId, folder.id))
}

async function main() {
  const config = readGraphConfig()
  console.log('Microsoft Graph check\n')

  if (!isGraphConfigured() || !config) {
    console.log('  FAIL  configuration — set GRAPH_TENANT_ID, GRAPH_CLIENT_ID and a credential.')
    console.log('        GRAPH_TENANT_ID must be the tenant GUID; "common" is the login app only.')
    process.exitCode = 1
    return
  }

  pass('configuration', `tenant ${config.tenantId}, client ${config.clientId}`)
  pass('credential', config.certificate ? 'certificate' : 'client secret')

  const token = await step(
    'get an app-only token',
    () => getAccessToken({ force: true }),
    () => 'issued',
  )
  if (!token) {
    console.log('\nStop here: without a token nothing else can be checked.')
    process.exitCode = 1
    return
  }

  if (!config.internalDriveId || !config.clientDriveId) {
    console.log('\n  FAIL  drives — set GRAPH_INTERNAL_DRIVE_ID and GRAPH_CLIENT_DRIVE_ID.')
    console.log('        No ids yet? `pnpm graph:sites` lists them once the app has its grants.')
    process.exitCode = 1
    return
  }

  await checkDrive('Internal library', config.internalDriveId)
  const clientRoot = await checkDrive('Client library', config.clientDriveId)
  if (clientRoot) await checkWrite(config.clientDriveId, clientRoot)

  console.log(
    `\n${failed ? 'Something failed — the lines above say which step and why.' : 'Everything passed. The mirror can be started.'}`,
  )
  // exitCode rather than exit(): a socket still open makes Node abort on Windows.
  process.exitCode = failed ? 1 : 0
}

await main()
