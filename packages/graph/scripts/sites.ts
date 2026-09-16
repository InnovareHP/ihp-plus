/**
 * Lists the sites and libraries this app can reach, with the ids .env wants:
 *   pnpm graph:sites
 * Finding those by hand means composing `hostname,siteId,webId` from three places, which is
 * where every setup attempt so far has gone wrong.
 */
import { GraphError, graphJson } from '../src/client'
import { isGraphConfigured } from '../src/config'
import type { DriveItem } from '../src/types'

interface Site {
  id: string
  name?: string
  displayName?: string
  webUrl?: string
}

function explain(error: unknown) {
  if (!(error instanceof GraphError)) return error instanceof Error ? error.message : String(error)
  if (error.status === 401 || error.status === 403) {
    return `${error.code} (HTTP ${error.status}) — the app has no consented Sites permission yet, or no grant on this site.`
  }
  return `${error.code} (HTTP ${error.status})`
}

async function drivesOf(site: Site) {
  try {
    const payload = await graphJson<{ value: DriveItem[] }>(`/sites/${site.id}/drives`)
    for (const drive of payload.value) {
      console.log(`    drive  ${drive.name ?? 'unnamed'}`)
      console.log(`           ${drive.id}`)
    }
  } catch (error) {
    console.log(`    drives unavailable — ${explain(error)}`)
  }
}

async function main() {
  if (!isGraphConfigured()) {
    console.log('Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID and a credential first.')
    process.exitCode = 1
    return
  }

  try {
    // search=* is the only listing an app-only token gets; Sites.Selected alone will refuse it.
    const payload = await graphJson<{ value: Site[] }>('/sites?search=*')
    if (payload.value.length === 0) {
      console.log('No sites came back. The app is consented but granted on nothing yet.')
      return
    }

    for (const site of payload.value) {
      console.log(`\n${site.displayName ?? site.name ?? 'unnamed site'}  ${site.webUrl ?? ''}`)
      console.log(`  site   ${site.id}`)
      await drivesOf(site)
    }

    console.log(
      '\nPut the Documents drive ids in .env as GRAPH_INTERNAL_DRIVE_ID and GRAPH_CLIENT_DRIVE_ID.',
    )
  } catch (error) {
    console.log(`Could not list sites — ${explain(error)}`)
    console.log('With Sites.Selected the listing is refused by design; ask the admin for the site')
    console.log(
      'ids, or read them from <tenant>.sharepoint.com/sites/<site>/_api/site/id and /_api/web/id.',
    )
    process.exitCode = 1
  }
}

await main()
