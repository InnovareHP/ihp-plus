/*
 * Monthly report takeaways, written by Claude Code instead of a paid AI call (see the
 * report-takeaways skill). Run from the repo root so .env is loaded:
 *   pnpm report:takeaways facts [--start YYYY-MM-DD --end YYYY-MM-DD] [--out file.json]
 *   pnpm report:takeaways save <file.json> [--write] [--replace]
 * Without dates it uses the report month (the last finished 25th to 24th).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dayKeyOf } from '@/features/website-analytics/days'
import { presetRange } from '@/features/website-analytics/report-range'
import { REPORT_TIME_ZONE } from '@/features/website-analytics/sites'
import { collectFacts, saveDrafted } from '@/features/website-analytics/takeaways-batch'

const [command, ...rest] = process.argv.slice(2)

function option(name: string): string | undefined {
  const at = rest.indexOf(`--${name}`)
  return at === -1 ? undefined : rest[at + 1]
}

async function facts() {
  const fallback = presetRange('report-month', dayKeyOf(new Date(), REPORT_TIME_ZONE))
  const range = { start: option('start') ?? fallback.start, end: option('end') ?? fallback.end }
  const sites = await collectFacts(range)
  const json = JSON.stringify({ range, sites }, null, 2)
  const out = option('out')
  if (out) {
    writeFileSync(out, json)
    const failed = sites.filter((site) => site.error)
    console.log(`Wrote ${sites.length} sites for ${range.start} to ${range.end} to ${out}.`)
    for (const site of failed) console.log(`  Could not read ${site.name}: ${site.error}`)
  } else {
    console.log(json)
  }
}

async function save() {
  const file = rest.find((arg) => !arg.startsWith('--'))
  if (!file) throw new Error('Name the takeaways file: save <file.json> [--write] [--replace]')
  const write = rest.includes('--write')
  const outcome = await saveDrafted(JSON.parse(readFileSync(file, 'utf8')), {
    write,
    replace: rest.includes('--replace'),
  })
  console.log(`${write ? 'Saved' : 'Would save (dry run, add --write)'}: ${outcome.saved.length}`)
  for (const name of outcome.saved) console.log(`  ${name}`)
  for (const skip of outcome.skipped) console.log(`  Skipped ${skip.site}: ${skip.reason}`)
}

const commands: Record<string, () => Promise<void>> = { facts, save }
const run = command ? commands[command] : undefined
if (!run) {
  console.error('Use: facts [--start --end --out]  or  save <file.json> [--write] [--replace]')
  process.exit(1)
}
run()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
