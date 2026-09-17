/**
 * Creates a Communication site — storage without the Microsoft 365 group a Team site drags
 * behind it:
 *   pnpm graph:new-site https://<tenant>.sharepoint.com/sites/<name> "Site title"
 * Graph cannot make one, so this talks to SharePoint's own site manager with an admin's token.
 */
import { readGraphConfig } from '../src/config'

/** SharePoint Online Management Shell: a first-party public client, so nothing to register. */
const DEVICE_CLIENT_ID = '9bc3ab49-b65d-410a-85ad-de819febfddc'
/** A site page publishing template is the communication site; no group, no mailbox, no Teams. */
const COMMUNICATION_SITE = 'SITEPAGEPUBLISHING#0'

interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function claimsOf(token: string) {
  const part = token.split('.')[1] ?? ''
  return JSON.parse(Buffer.from(part, 'base64url').toString()) as { upn?: string; unique_name?: string }
}

async function signIn(tenantId: string, host: string) {
  const base = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`
  const started = await fetch(`${base}/devicecode`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DEVICE_CLIENT_ID,
      scope: `https://${host}/AllSites.FullControl offline_access`,
    }).toString(),
  })
  const code = (await started.json()) as DeviceCode & { error_description?: string }
  if (!code.device_code) throw new Error(code.error_description ?? 'Could not start the sign-in.')

  console.log('\n  Open      ' + code.verification_uri)
  console.log('  Enter     ' + code.user_code)
  console.log('  Sign in as a SharePoint or Global Administrator.\n')

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
    if (payload.error === 'authorization_pending' || payload.error === 'slow_down') continue
    throw new Error(payload.error_description ?? payload.error ?? 'Sign-in failed.')
  }

  throw new Error('The sign-in code expired.')
}

async function createSite(token: string, siteUrl: string, title: string, owner: string) {
  const host = new URL(siteUrl).host
  const response = await fetch(`https://${host}/_api/SPSiteManager/create`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json;odata=verbose',
      'content-type': 'application/json;odata=verbose',
    },
    body: JSON.stringify({
      request: {
        Title: title,
        Url: siteUrl,
        Lcid: 1033,
        ShareByEmailEnabled: false,
        WebTemplate: COMMUNICATION_SITE,
        Owner: owner,
        Description: '',
        Classification: '',
      },
    }),
  })

  const payload = (await response.json()) as {
    d?: { Create?: { SiteStatus?: number; SiteUrl?: string; ErrorMessage?: string } }
    error?: { message?: { value?: string } }
  }
  const created = payload.d?.Create

  if (!response.ok || !created) {
    throw new Error(payload.error?.message?.value ?? `HTTP ${response.status}`)
  }
  // 2 is created, 1 is still provisioning, 3 is an error with a message worth repeating.
  if (created.SiteStatus === 3 || created.ErrorMessage) {
    throw new Error(created.ErrorMessage ?? 'SharePoint refused to create that site.')
  }

  return created.SiteUrl ?? siteUrl
}

async function main() {
  const [siteUrl, ...titleParts] = process.argv.slice(2)
  const config = readGraphConfig()

  if (!config) {
    console.log('Set GRAPH_TENANT_ID and GRAPH_CLIENT_ID in .env first.')
    process.exitCode = 1
    return
  }
  if (!siteUrl) {
    console.log('Usage: pnpm graph:new-site https://<tenant>.sharepoint.com/sites/<name> "Title"')
    process.exitCode = 1
    return
  }

  const title = titleParts.join(' ') || (new URL(siteUrl).pathname.split('/').pop() ?? 'Documents')
  console.log(`Creating a communication site at ${siteUrl}`)

  try {
    const token = await signIn(config.tenantId, new URL(siteUrl).host)
    const claims = claimsOf(token)
    const owner = claims.upn ?? claims.unique_name
    if (!owner) throw new Error('That token carries no user name to own the site with.')

    const created = await createSite(token, siteUrl, title, owner)
    console.log(`\n  Created   ${created}`)
    console.log('\nNow grant the app on it:')
    console.log(`  pnpm graph:grant <internal site URL> ${created}`)
  } catch (error) {
    console.log(`\n  FAILED    ${error instanceof Error ? error.message : String(error)}`)
    console.log('\nSharePoint → + Create site → Communication site does the same thing by hand.')
    process.exitCode = 1
  }
}

await main()
