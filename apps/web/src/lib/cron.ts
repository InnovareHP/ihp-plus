import { timingSafeEqual } from 'node:crypto'

// Vercel Cron sends CRON_SECRET as a bearer token; with no secret set, nothing may trigger a job.
export function isAuthorizedCron(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
