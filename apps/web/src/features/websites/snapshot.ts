import chromium from '@sparticuz/chromium'
import { db } from '@ihp/db'
import puppeteer, { type Browser } from 'puppeteer-core'
import { putObject } from '@/lib/s3'
import { resolvesPublic } from './probe'
import type { CheckRound } from './schema'
import { requestAllowed } from './utils/request-guard'
import { snapshotKey } from './utils/snapshot-key'

const VIEWPORT = { width: 1280, height: 800 }
const THUMB_WIDTH = 400
const NAVIGATION_TIMEOUT_MS = 20_000
// Late fonts and hero images land just after `load`; a short pause keeps them in the picture.
const SETTLE_MS = 1_000
const WEBP_QUALITY = 70
// Each tab is a full renderer, so a few at a time is what one function's memory holds.
const PAGES_AT_ONCE = 3

// WebRTC slips past request interception, so it is kept off any route that is not proxied.
const LOCKDOWN_ARGS = [
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--no-first-run',
]

export class SnapshotUnavailableError extends Error {
  constructor() {
    super('No browser for snapshots here — set SNAPSHOT_CHROME_PATH to a local Chrome.')
    this.name = 'SnapshotUnavailableError'
  }
}

async function launchBrowser(): Promise<Browser> {
  const localChrome = process.env.SNAPSHOT_CHROME_PATH
  if (localChrome) {
    return puppeteer.launch({
      executablePath: localChrome,
      headless: true,
      defaultViewport: VIEWPORT,
      args: LOCKDOWN_ARGS,
    })
  }
  // The bundled Chromium is a Linux build for serverless hosts; anywhere else needs a local one.
  if (process.platform !== 'linux') throw new SnapshotUnavailableError()
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: await puppeteer.defaultArgs({
      args: [...chromium.args, ...LOCKDOWN_ARGS],
      headless: 'shell',
    }),
    headless: 'shell',
    defaultViewport: VIEWPORT,
  })
}

interface Shot {
  full: Uint8Array
  thumb: Uint8Array
}

async function shoot(browser: Browser, url: string): Promise<Shot> {
  const page = await browser.newPage()
  try {
    const verdicts = new Map<string, Promise<boolean>>()
    const isPublic = (hostname: string) => {
      let verdict = verdicts.get(hostname)
      if (!verdict) {
        verdict = resolvesPublic(hostname)
        verdicts.set(hostname, verdict)
      }
      return verdict
    }

    // A service worker answers from its own cache, out of the interceptor's sight.
    await page.setBypassServiceWorker(true)
    // WebSockets skip request interception too, so they are cut off at the network layer instead.
    const cdp = await page.createCDPSession()
    await cdp.send('Network.enable')
    await cdp.send('Network.setBlockedURLs', { urls: ['ws://*', 'wss://*'] })
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      requestAllowed(request.url(), request.resourceType(), isPublic)
        .then((allowed) => (allowed ? request.continue() : request.abort('blockedbyclient')))
        // The page may already be closing; an unanswered request then no longer matters.
        .catch(() => undefined)
    })

    try {
      await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS })
    } catch (error) {
      // A page that never finishes loading still has something on screen worth seeing.
      if (!(error instanceof Error && error.name === 'TimeoutError')) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))

    const full = await page.screenshot({ type: 'webp', quality: WEBP_QUALITY })
    const thumb = await page.screenshot({
      type: 'webp',
      quality: WEBP_QUALITY,
      clip: { x: 0, y: 0, ...VIEWPORT, scale: THUMB_WIDTH / VIEWPORT.width },
    })
    return { full, thumb }
  } finally {
    await page.close().catch(() => undefined)
  }
}

export interface CaptureJob {
  organizationId: string
  /** The check's day, carried in so a capture that crosses midnight still files under it. */
  dateKey: string
  round: CheckRound
  websiteIds: string[]
}

/** Opens each site in one shared browser and stores its picture for the card to show today. */
export async function captureSnapshots(job: CaptureJob) {
  const sites = await db.website.findMany({
    where: { organizationId: job.organizationId, id: { in: job.websiteIds }, archivedAt: null },
    select: { id: true, url: true },
  })
  const summary = { captured: 0, failed: 0 }
  if (sites.length === 0) return summary

  const browser = await launchBrowser()
  try {
    for (let start = 0; start < sites.length; start += PAGES_AT_ONCE) {
      await Promise.all(
        sites.slice(start, start + PAGES_AT_ONCE).map(async (site) => {
          const keyOf = (size: 'thumb' | 'full') =>
            snapshotKey(job.organizationId, job.dateKey, site.id, job.round, size)
          try {
            const shot = await shoot(browser, site.url)
            await putObject(keyOf('full'), shot.full, 'image/webp')
            await putObject(keyOf('thumb'), shot.thumb, 'image/webp')
            summary.captured += 1
          } catch (error) {
            // One broken site must not cost the rest of the round its pictures.
            summary.failed += 1
            console.error(`[websites] snapshot of ${site.id} failed`, error)
          }
        }),
      )
    }
  } finally {
    await browser.close().catch(() => undefined)
  }
  return summary
}
