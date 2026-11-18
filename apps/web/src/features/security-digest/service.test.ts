import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  securityDigestSettings: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  securityDigestIssue: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  securityDigestDelivery: { createMany: vi.fn() },
  client: { findMany: vi.fn() },
}))
const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(() => true),
  securityDigestTemplate: vi.fn(() => ({ subject: 'Security tip', html: '<p/>', text: 'tip' })),
  SECURITY_DIGEST_HERO_ID: 'security-digest-hero',
}))
const ai = vi.hoisted(() => {
  class DigestAiError extends Error {}
  return { DigestAiError, generateIssue: vi.fn(), isAiConfigured: vi.fn(() => true) }
})

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', () => email)
vi.mock('./generate', () => ai)
vi.mock('./graphic', () => ({ digestGraphicBytes: vi.fn(async () => new Uint8Array([1])) }))
vi.mock('@/features/websites/service', () => ({ timeZoneOf: vi.fn(async () => 'UTC') }))

const { draftIssueFor, runDigest, sendIssue } = await import('./service')

const SETTINGS = {
  organizationId: 'org-1',
  enabled: true,
  recipients: ['me@ihp.test'],
  includeClients: false,
  reportTo: 'it@ihp.test',
}
const ISSUE = {
  id: 'issue-1',
  organizationId: 'org-1',
  topic: 'phishing',
  title: 'Spot a fake invoice',
  preheader: 'Three checks.',
  intro: ['A vendor emails.'],
  tips: ['Call them.', 'Check the sender.', 'Ask IT.'],
  takeaway: 'Pause first.',
}
// A Thursday, so the draft is for Monday the 23rd.
const THURSDAY = new Date('2026-11-19T14:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prisma.securityDigestSettings.findUnique.mockResolvedValue(SETTINGS)
  prisma.securityDigestIssue.updateMany.mockResolvedValue({ count: 1 })
  prisma.securityDigestIssue.findUniqueOrThrow.mockResolvedValue(ISSUE)
  prisma.securityDigestIssue.findFirst.mockResolvedValue(null)
  prisma.securityDigestIssue.create.mockResolvedValue({ id: 'new-issue' })
  prisma.securityDigestIssue.findMany.mockResolvedValue([])
  prisma.client.findMany.mockResolvedValue([{ email: 'client@acme.test' }])
  email.sendEmail.mockResolvedValue({ delivered: true })
})

describe('sendIssue', () => {
  it('mails every recipient once with the header inline and logs each delivery', async () => {
    expect(await sendIssue('issue-1', THURSDAY)).toEqual({ claimed: true, sent: 1, failed: 0 })

    expect(prisma.securityDigestIssue.updateMany).toHaveBeenCalledWith({
      where: { id: 'issue-1', status: 'approved' },
      data: { status: 'sent', sentAt: THURSDAY },
    })
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'me@ihp.test',
        attachments: [expect.objectContaining({ contentId: 'security-digest-hero' })],
      }),
    )
    expect(email.securityDigestTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ reportTo: 'it@ihp.test', hasHero: true }),
    )
    expect(prisma.securityDigestDelivery.createMany).toHaveBeenCalledWith({
      data: [{ issueId: 'issue-1', email: 'me@ihp.test', status: 'sent' }],
    })
    expect(prisma.client.findMany).not.toHaveBeenCalled()
  })

  it('adds active client contacts only when IT turned them on', async () => {
    prisma.securityDigestSettings.findUnique.mockResolvedValue({
      ...SETTINGS,
      includeClients: true,
    })

    await sendIssue('issue-1')

    expect(email.sendEmail).toHaveBeenCalledTimes(2)
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1', status: 'active' }),
      }),
    )
  })

  it('does nothing when another run already claimed the issue', async () => {
    prisma.securityDigestIssue.updateMany.mockResolvedValue({ count: 0 })

    expect(await sendIssue('issue-1')).toEqual({ claimed: false, sent: 0, failed: 0 })
    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('marks the issue failed when nobody is on the list', async () => {
    prisma.securityDigestSettings.findUnique.mockResolvedValue({ ...SETTINGS, recipients: [] })

    await sendIssue('issue-1')

    expect(email.sendEmail).not.toHaveBeenCalled()
    expect(prisma.securityDigestIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    )
  })

  it('marks the issue failed when no address accepted it', async () => {
    email.sendEmail.mockResolvedValue({ delivered: false, reason: 'send-failed' })

    expect(await sendIssue('issue-1')).toEqual({ claimed: true, sent: 0, failed: 1 })
    expect(prisma.securityDigestDelivery.createMany).toHaveBeenCalledWith({
      data: [{ issueId: 'issue-1', email: 'me@ihp.test', status: 'failed' }],
    })
    expect(prisma.securityDigestIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    )
  })
})

describe('draftIssueFor', () => {
  it('drafts the next topic for the coming Monday', async () => {
    prisma.securityDigestIssue.findMany.mockResolvedValue([
      { title: 'Last week', topic: 'phishing' },
    ])
    ai.generateIssue.mockResolvedValue({
      issue: { title: 'Use a passphrase' },
      model: 'model-1',
      inputTokens: 1,
      outputTokens: 2,
    })

    expect(await draftIssueFor('org-1', THURSDAY)).toEqual({ id: 'new-issue', created: true })
    expect(ai.generateIssue).toHaveBeenCalledWith('passwords', ['Last week'])
    expect(prisma.securityDigestIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          topic: 'passwords',
          sendOn: new Date('2026-11-23T00:00:00.000Z'),
          title: 'Use a passphrase',
        }),
      }),
    )
  })

  it('leaves an issue already waiting for that Monday alone', async () => {
    prisma.securityDigestIssue.findFirst.mockResolvedValue({ id: 'waiting' })

    expect(await draftIssueFor('org-1', THURSDAY)).toEqual({ id: 'waiting', created: false })
    expect(ai.generateIssue).not.toHaveBeenCalled()
  })

  it('records a model failure as a failed issue IT can see', async () => {
    ai.generateIssue.mockRejectedValue(new ai.DigestAiError('The AI could not be reached.'))

    await draftIssueFor('org-1', THURSDAY)

    expect(prisma.securityDigestIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', error: 'The AI could not be reached.' }),
      }),
    )
  })
})

describe('runDigest', () => {
  it('sends approved issues whose day has come, for enabled organizations only', async () => {
    prisma.securityDigestIssue.findMany.mockResolvedValue([
      { id: 'issue-1', organizationId: 'org-1', sendOn: new Date('2026-11-19T00:00:00.000Z') },
      { id: 'later', organizationId: 'org-1', sendOn: new Date('2026-11-20T00:00:00.000Z') },
      { id: 'off', organizationId: 'org-2', sendOn: new Date('2026-11-19T00:00:00.000Z') },
    ])
    prisma.securityDigestSettings.findMany.mockResolvedValue([{ organizationId: 'org-1' }])

    expect(await runDigest('send', THURSDAY)).toEqual({
      organizations: 0,
      drafted: 0,
      issues: 1,
      emailed: 1,
    })
    expect(prisma.securityDigestIssue.updateMany).toHaveBeenCalledTimes(1)
  })

  it('drafts once per enabled organization', async () => {
    prisma.securityDigestSettings.findMany.mockResolvedValue([{ organizationId: 'org-1' }])
    prisma.securityDigestIssue.findFirst.mockResolvedValue({ id: 'waiting' })

    expect(await runDigest('draft', THURSDAY)).toMatchObject({ organizations: 1, drafted: 0 })
  })
})
