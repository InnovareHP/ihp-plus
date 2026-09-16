/**
 * Grants the daemon app write on the two libraries in .env:
 *   pnpm graph:grant
 * Sites.Selected is an empty container until an admin grants per site, and the grant call needs
 * an admin's own token — so this signs one in by device code rather than asking for a password.
 */
import { readGraphConfig } from '../src/config'

/** Microsoft's own public client, the one Connect-MgGraph uses; no app registration to change. */
const DEVICE_CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e'
const SCOPE = 'https://graph.microsoft.com/Sites.FullControl.All offline_access'
const GRAPH = 'https://graph.microsoft.com/v1.0'

interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
  message?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function signIn(tenantId: string) {
  const base = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`
  const started = await fetch(`${base}/devicecode`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: DEVICE_CLIENT_ID, scope: SCOPE }).toString(),
  })
  const code = (await started.json()) as DeviceCode & { error_description?: string }
  if (!code.device_code) throw new Error(code.error_description ?? 'Could not start the sign-in.')

  console.log('\n  Open      ' + code.verification_uri)
  console.log('  Enter     ' + code.user_code)
  console.log('  Sign in as a Global Administrator, and consent if you are asked.\n')

  const deadline = Date.now() + code.expires_in * 1000
  while (Date.now() < deadline) {
    await sleep(code.interval * 1000)
    const response = await fetch(`${base}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DEVICE_CLIENT_ID,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: code.device_code,
      }).toString(),
    })
    const payload = (await response.json()) as {
      access_token?: string
      error?: string
      error_description?: string
    }

    if (payload.access_token) return payload.access_token
    if (payload.error === 'authorization_pending') continue
    if (payload.error === 'slow_down') {
      await sleep(code.interval * 1000)
      continue
    }
    throw new Error(payload.error_description ?? payload.error ?? 'Sign-in failed.')
  }

  throw new Error('The sign-in code expired.')
}

async function call<T>(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string }
  }
  if (!response.ok) {
    throw new Error(
      `${payload.error?.code ?? response.status}: ${payload.error?.message ?? 'request failed'}`,
    )
  }
  return payload
}

/** The site a library belongs to, read off the library rather than asked for. */
async function siteOf(token: string, driveId: string) {
  const drive = await call<{ webUrl?: string; name?: string }>(token, `/drives/${driveId}`)
  if (!drive.webUrl) throw new Error('That library reported no URL.')

  const url = new URL(drive.webUrl)
  const parts = url.pathname.split('/').filter(Boolean)
  // A site library is /sites/<name>/<library>; the tenant root site has no /sites/ prefix.
  const path = parts[0] === 'sites' && parts[1] ? `/sites/${parts[1]}` : ''
  return { address: `${url.host}:${path}:`, webUrl: `${url.origin}${path}` }
}

async function grant(token: string, label: string, driveId: string, appId: string) {
  console.log(`\n${label}`)
  try {
    const site = await siteOf(token, driveId)
    console.log(`  site      ${site.webUrl}`)

    const permission = await call<{ id: string; roles?: string[] }>(
      token,
      `/sites/${site.address}/permissions`,
      {
        method: 'POST',
        body: JSON.stringify({
          roles: ['write'],
          grantedToIdentities: [{ application: { id: appId, displayName: 'ihp-plus-graph' } }],
        }),
      },
    )
    console.log(
      `  granted   ${permission.roles?.join(', ') ?? 'write'} (permission ${permission.id})`,
    )
    return true
  } catch (error) {
    console.log(`  FAILED    ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function main() {
  const config = readGraphConfig()
  if (!config) {
    console.log('Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID and a credential in .env first.')
    process.exitCode = 1
    return
  }
  if (!config.internalDriveId || !config.clientDriveId) {
    console.log('Set GRAPH_INTERNAL_DRIVE_ID and GRAPH_CLIENT_DRIVE_ID in .env first.')
    process.exitCode = 1
    return
  }

  console.log(`Granting ${config.clientId} write on both libraries.`)
  const token = await signIn(config.tenantId)
  console.log('  Signed in.')

  const internal = await grant(token, 'Internal library', config.internalDriveId, config.clientId)
  const client = await grant(token, 'Client library', config.clientDriveId, config.clientId)

  console.log(
    `\n${internal && client ? 'Both granted. Run `pnpm graph:check`.' : 'Something failed — the lines above say what.'}`,
  )
  process.exitCode = internal && client ? 0 : 1
}

await main()
