import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  website: { findMany: vi.fn() },
  teamLead: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
}))
const access = vi.hoisted(() => ({ itTeamIdOf: vi.fn(async () => 'team-it') }))
const expiry = vi.hoisted(() => ({ expiryOf: vi.fn() }))
const service = vi.hoisted(() => ({ timeZoneOf: vi.fn(async () => 'Asia/Manila') }))
const email = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ delivered: true })),
  portalUrl: (path: string) => `https://portal.test/app${path}`,
  websiteExpiryReportTemplate: vi.fn((options: unknown) => ({ subject: 'report', options })),
  websiteExpiryAlertTemplate: vi.fn((options: unknown) => ({ subject: 'alert', options })),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./expiry', () => expiry)
vi.mock('./service', () => service)
vi.mock('@/lib/email', () => email)

const { runExpiryEmails } = await import('./expiry-emails')

const now = new Date('2026-11-06T01:30:00.000Z')
const inDays = (days: number) =>
  new Date(now.getTime() + days * 86_400_000 + 3_600_000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  prisma.website.findMany.mockImplementation(async (args: { distinct?: unknown }) =>
    args.distinct
      ? [{ organizationId: 'org-1' }]
      : [
          { name: 'Alpha', url: 'https://alpha.example' },
          { name: 'Beta', url: 'https://beta.example' },
        ],
  )
  prisma.teamLead.findMany.mockResolvedValue([{ userId: 'lead-1' }, { userId: 'lead-2' }])
  prisma.user.findMany.mockResolvedValue([
    { email: 'lead@example.com', banned: false },
    { email: 'gone@example.com', banned: true },
  ])
  expiry.expiryOf.mockImplementation(async (url: string) =>
    url.includes('alpha')
      ? { domain: inDays(200), ssl: inDays(60) }
      : { domain: inDays(7), ssl: undefined },
  )
})

describe('runExpiryEmails', () => {
  it('sends the monthly dates to the IT lead only', async () => {
    const summary = await runExpiryEmails('monthly', now)

    expect(summary).toEqual({ organizations: 1, sites: 2, emailed: 1, noLead: 0 })
    expect(prisma.teamLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1', teamId: 'team-it' } }),
    )
    expect(email.sendEmail).toHaveBeenCalledTimes(1)
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'lead@example.com', subject: 'report' }),
    )
    expect(email.websiteExpiryReportTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ monthLabel: 'November 2026', expiringSoon: 1 }),
    )
  })

  it('alerts on a renewal that lands on an alert day', async () => {
    await runExpiryEmails('alerts', now)

    expect(email.websiteExpiryAlertTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ alerts: ['Beta: domain expires Nov 13, 2026 (7 days)'] }),
    )
    expect(email.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('sends nothing on a day with no alert', async () => {
    expiry.expiryOf.mockResolvedValue({ domain: inDays(200), ssl: inDays(60) })

    const summary = await runExpiryEmails('alerts', now)

    expect(summary.emailed).toBe(0)
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('skips an organization with no IT lead instead of emailing someone else', async () => {
    access.itTeamIdOf.mockResolvedValueOnce(undefined as never)

    const summary = await runExpiryEmails('monthly', now)

    expect(summary.noLead).toBe(1)
    expect(expiry.expiryOf).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('keeps going when one address fails', async () => {
    prisma.user.findMany.mockResolvedValue([
      { email: 'first@example.com', banned: false },
      { email: 'second@example.com', banned: false },
    ])
    email.sendEmail.mockRejectedValueOnce(new Error('mailbox full'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const summary = await runExpiryEmails('monthly', now)

    expect(email.sendEmail).toHaveBeenCalledTimes(2)
    expect(summary.emailed).toBe(1)
  })
})
