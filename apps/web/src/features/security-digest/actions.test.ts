import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  securityDigestIssue: { updateMany: vi.fn(), findFirst: vi.fn() },
}))
const access = vi.hoisted(() => ({ websitesAccess: vi.fn() }))
const guard = vi.hoisted(() => ({ requireOnboarded: vi.fn() }))
const service = vi.hoisted(() => ({
  NO_RECIPIENTS: 'Nobody to send to — add a recipient.',
  draftIssueFor: vi.fn(),
  overviewOf: vi.fn(),
  saveSettings: vi.fn(),
  sendIssue: vi.fn(),
  sendTestCopy: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/features/websites/access', () => access)
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('./service', () => service)

const actions = await import('./actions')

const LEAD = {
  userId: 'user-1',
  userName: 'Ada Lovelace',
  organizationId: 'org-1',
  canView: true,
  canManage: true,
}
const ISSUE_ID = '6f1c2b8e-4a3d-4e5f-9a1b-2c3d4e5f6a7b'
const SETTINGS = { enabled: true, recipients: ['me@ihp.test'], includeClients: false, reportTo: '' }

beforeEach(() => {
  vi.clearAllMocks()
  access.websitesAccess.mockResolvedValue(LEAD)
  prisma.securityDigestIssue.updateMany.mockResolvedValue({ count: 1 })
})

describe('who may use the security emails', () => {
  it('hides everything from someone outside IT', async () => {
    access.websitesAccess.mockResolvedValue({ ...LEAD, canView: false, canManage: false })

    expect(await actions.getDigestOverview()).toEqual({
      ok: false,
      message: 'This page is only for the IT department.',
    })
    expect(service.overviewOf).not.toHaveBeenCalled()
  })

  it('lets an IT member read but not change anything', async () => {
    access.websitesAccess.mockResolvedValue({ ...LEAD, canManage: false })
    service.overviewOf.mockResolvedValue({ issues: [] })

    expect((await actions.getDigestOverview()).ok).toBe(true)
    expect(service.overviewOf).toHaveBeenCalledWith('org-1', false)
    expect((await actions.saveDigestSettings(SETTINGS)).ok).toBe(false)
    expect((await actions.approveDigestIssue({ issueId: ISSUE_ID })).ok).toBe(false)
    expect((await actions.generateDigestDraft()).ok).toBe(false)
    expect(service.saveSettings).not.toHaveBeenCalled()
    expect(prisma.securityDigestIssue.updateMany).not.toHaveBeenCalled()
  })
})

describe('saveDigestSettings', () => {
  it('saves valid settings for the caller’s organization', async () => {
    expect(await actions.saveDigestSettings(SETTINGS)).toEqual({ ok: true, data: SETTINGS })
    expect(service.saveSettings).toHaveBeenCalledWith('org-1', SETTINGS)
  })

  it('refuses an address that is not an email', async () => {
    expect((await actions.saveDigestSettings({ ...SETTINGS, recipients: ['nope'] })).ok).toBe(false)
    expect(service.saveSettings).not.toHaveBeenCalled()
  })
})

describe('approveDigestIssue', () => {
  it('approves only a draft in the caller’s organization and records who', async () => {
    expect(await actions.approveDigestIssue({ issueId: ISSUE_ID })).toEqual({
      ok: true,
      data: { issueId: ISSUE_ID },
    })
    expect(prisma.securityDigestIssue.updateMany).toHaveBeenCalledWith({
      where: { id: ISSUE_ID, organizationId: 'org-1', status: { in: ['draft'] } },
      data: expect.objectContaining({
        status: 'approved',
        decidedById: 'user-1',
        decidedByName: 'Ada Lovelace',
      }),
    })
  })

  it('says so when the issue is no longer a draft', async () => {
    prisma.securityDigestIssue.updateMany.mockResolvedValue({ count: 0 })

    expect((await actions.approveDigestIssue({ issueId: ISSUE_ID })).ok).toBe(false)
  })
})

describe('sendDigestIssueNow', () => {
  it('sends an approved issue from the caller’s organization', async () => {
    prisma.securityDigestIssue.findFirst.mockResolvedValue({ id: ISSUE_ID })
    service.sendIssue.mockResolvedValue({ claimed: true, sent: 2, failed: 0 })

    expect(await actions.sendDigestIssueNow({ issueId: ISSUE_ID })).toEqual({
      ok: true,
      data: { sent: 2, failed: 0 },
    })
  })

  it('refuses another organization’s issue', async () => {
    prisma.securityDigestIssue.findFirst.mockResolvedValue(null)

    expect((await actions.sendDigestIssueNow({ issueId: ISSUE_ID })).ok).toBe(false)
    expect(service.sendIssue).not.toHaveBeenCalled()
  })
})

describe('sendDigestTest', () => {
  it('sends the test only to the person asking', async () => {
    guard.requireOnboarded.mockResolvedValue({ user: { email: 'ada@ihp.test' } })
    service.sendTestCopy.mockResolvedValue({ delivered: true })

    expect(await actions.sendDigestTest({ issueId: ISSUE_ID })).toEqual({
      ok: true,
      data: { to: 'ada@ihp.test' },
    })
    expect(service.sendTestCopy).toHaveBeenCalledWith(ISSUE_ID, 'org-1', 'ada@ihp.test')
  })
})
