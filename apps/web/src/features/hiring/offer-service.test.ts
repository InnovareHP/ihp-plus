import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  jobApplication: { findFirst: vi.fn() },
  jobOffer: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  applicationEvent: { create: vi.fn() },
  organization: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}))
const access = vi.hoisted(() => ({ requireHiringCaller: vi.fn() }))
const pipeline = vi.hoisted(() => ({ loadApplication: vi.fn() }))
const link = vi.hoisted(() => ({ findByLink: vi.fn() }))
const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: (path: string) => `https://ihp.test/app${path}`,
  jobOfferTemplate: vi.fn(() => ({ subject: 'offer', html: '', text: '' })),
  offerAnsweredTemplate: vi.fn(() => ({ subject: 'answered', html: '', text: '' })),
}))
const storage = vi.hoisted(() => ({
  putObject: vi.fn(),
  objectUrl: vi.fn(),
  S3NotConfiguredError: class extends Error {},
}))
const team = vi.hoisted(() => ({
  hiringAdminEmails: vi.fn(),
  firstNameOf: (name: string) => name.split(' ')[0] ?? name,
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./pipeline-service', () => pipeline)
vi.mock('./public-service', () => link)
vi.mock('./notifications', () => team)
vi.mock('@/lib/email', () => email)
vi.mock('@/lib/s3', () => storage)
vi.mock('./status-link', () => ({
  statusUrl: () => 'https://ihp.test/app/careers/status/app-1/sig',
}))

const { answerOffer, sendOffer } = await import('./offer-service')

const STAGES = [
  { id: 'applied', name: 'Applied', message: '' },
  { id: 'offer', name: 'Offer', message: '' },
]
const APPLICATION = {
  id: 'app-1',
  organizationId: 'org-1',
  fullName: 'Grace Hopper',
  email: 'grace@example.com',
  postingTitle: 'Registered nurse',
  status: 'active',
  stageId: 'offer',
  createdAt: new Date('2030-01-01T00:00:00.000Z'),
  posting: { stages: STAGES },
}
const OFFER = {
  id: 'offer-1',
  status: 'sent',
  message: 'Welcome aboard.',
  createdById: 'user-hr',
  createdAt: new Date(),
}

function letter(type = 'application/pdf', bytes = 'letter') {
  return new File([bytes], 'offer.pdf', { type })
}

async function errorOf(operation: () => Promise<unknown>) {
  return operation().then(
    () => undefined,
    (thrown: unknown) => ConnectError.from(thrown),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  access.requireHiringCaller.mockResolvedValue({ userId: 'user-hr', organizationId: 'org-1' })
  prisma.jobApplication.findFirst.mockResolvedValue(APPLICATION)
  prisma.jobOffer.findMany.mockResolvedValue([])
  prisma.jobOffer.create.mockResolvedValue({ id: 'offer-2' })
  prisma.organization.findUnique.mockResolvedValue({ name: 'IHP+' })
  prisma.$transaction.mockImplementation((run: (tx: typeof prisma) => Promise<unknown>) =>
    run(prisma),
  )
  pipeline.loadApplication.mockResolvedValue({ offers: [] })
  link.findByLink.mockResolvedValue(APPLICATION)
  prisma.jobOffer.updateMany.mockResolvedValue({ count: 1 })
  team.hiringAdminEmails.mockResolvedValue(['hr@ihp.test'])
})

describe('sending an offer', () => {
  it('stores the letter, records the offer and emails the applicant a link to answer it', async () => {
    await sendOffer({ applicationId: 'app-1', message: 'Welcome aboard.', file: letter() })

    expect(storage.putObject).toHaveBeenCalledWith(
      expect.stringMatching(/^hiring\/org-1\/offers\/app-1\/.+-offer\.pdf$/),
      expect.any(Uint8Array),
      'application/pdf',
    )
    expect(prisma.jobOffer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-1',
        createdById: 'user-hr',
        message: 'Welcome aboard.',
        fileName: 'offer.pdf',
        contentType: 'application/pdf',
      }),
    })
    expect(prisma.applicationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'offer_sent',
        detail: expect.objectContaining({ revised: false }),
      }),
    })
    expect(email.jobOfferTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Grace', hasLetter: true, revised: false }),
    )
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'grace@example.com' }),
    )
  })

  it('sends an offer with no letter at all', async () => {
    await sendOffer({ applicationId: 'app-1', message: 'Welcome aboard.', file: null })

    expect(storage.putObject).not.toHaveBeenCalled()
    expect(prisma.jobOffer.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ fileKey: expect.anything() }),
    })
  })

  it('is refused before they reach the offer stage', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, stageId: 'applied' })

    const error = await errorOf(() =>
      sendOffer({ applicationId: 'app-1', message: 'Welcome.', file: null }),
    )

    expect(error?.code).toBe(Code.FailedPrecondition)
    expect(error?.rawMessage).toBe('Move them to the offer stage first.')
    expect(prisma.jobOffer.create).not.toHaveBeenCalled()
  })

  it('recognises a custom stage HR named "Offer"', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({
      ...APPLICATION,
      stageId: 'stage-1a2b',
      posting: { stages: [...STAGES, { id: 'stage-1a2b', name: 'Final offer', message: '' }] },
    })

    await sendOffer({ applicationId: 'app-1', message: 'Welcome.', file: null })

    expect(prisma.jobOffer.create).toHaveBeenCalled()
  })

  it('will not send a second offer while the first is unanswered', async () => {
    prisma.jobOffer.findMany.mockResolvedValue([OFFER])

    const error = await errorOf(() =>
      sendOffer({ applicationId: 'app-1', message: 'Welcome.', file: null }),
    )

    expect(error?.code).toBe(Code.FailedPrecondition)
    expect(prisma.jobOffer.create).not.toHaveBeenCalled()
  })

  it('sends a revised offer after a decline, and says so in the email', async () => {
    prisma.jobOffer.findMany.mockResolvedValue([{ ...OFFER, status: 'declined' }])

    await sendOffer({ applicationId: 'app-1', message: 'We raised the salary.', file: null })

    expect(prisma.applicationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ detail: expect.objectContaining({ revised: true }) }),
    })
    expect(email.jobOfferTemplate).toHaveBeenCalledWith(expect.objectContaining({ revised: true }))
  })

  it('refuses a letter that is not a PDF or Word document', async () => {
    const error = await errorOf(() =>
      sendOffer({ applicationId: 'app-1', message: 'Welcome.', file: letter('image/png') }),
    )

    expect(error?.code).toBe(Code.InvalidArgument)
    expect(error?.rawMessage).toBe('Attach the letter as a PDF or Word document.')
    expect(storage.putObject).not.toHaveBeenCalled()
  })

  it('says plainly when there is nowhere to keep the letter', async () => {
    storage.putObject.mockRejectedValue(new storage.S3NotConfiguredError())

    const error = await errorOf(() =>
      sendOffer({ applicationId: 'app-1', message: 'Welcome.', file: letter() }),
    )

    expect(error?.code).toBe(Code.FailedPrecondition)
    expect(error?.rawMessage).toMatch(/File storage is not configured/)
  })
})

describe('answering an offer', () => {
  const ANSWER = { applicationId: 'app-1', signature: 'sig', offerId: 'offer-1' }

  beforeEach(() => prisma.jobOffer.findMany.mockResolvedValue([OFFER]))

  it('accepts it once and tells the hiring team', async () => {
    expect(await answerOffer({ ...ANSWER, decision: 'accept' })).toEqual({
      ok: true,
      data: undefined,
    })

    expect(prisma.jobOffer.updateMany).toHaveBeenCalledWith({
      where: { id: 'offer-1', status: 'sent' },
      data: expect.objectContaining({ status: 'accepted', declineReason: null }),
    })
    expect(prisma.applicationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'offer_accepted' }),
    })
    expect(email.offerAnsweredTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'accepted',
        url: 'https://ihp.test/app/hiring/applications/app-1',
      }),
    )
    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'hr@ihp.test' }))
  })

  it('declines with the reason, which HR reads', async () => {
    await answerOffer({ ...ANSWER, decision: 'decline', reason: 'The salary is too low.' })

    expect(prisma.jobOffer.updateMany).toHaveBeenCalledWith({
      where: { id: 'offer-1', status: 'sent' },
      data: expect.objectContaining({
        status: 'declined',
        declineReason: 'The salary is too low.',
      }),
    })
    expect(prisma.applicationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'offer_declined',
        detail: expect.objectContaining({ reason: 'The salary is too low.' }),
      }),
    })
  })

  it('will not decline without a reason', async () => {
    const result = await answerOffer({ ...ANSWER, decision: 'decline', reason: '  ' })

    expect(result).toEqual({ ok: false, message: 'Tell us why, so we can do better next time.' })
    expect(prisma.jobOffer.updateMany).not.toHaveBeenCalled()
  })

  it('refuses a forged link', async () => {
    link.findByLink.mockResolvedValue(null)

    expect(await answerOffer({ ...ANSWER, decision: 'accept' })).toEqual({
      ok: false,
      message: 'That link is not valid.',
    })
  })

  it('refuses an old offer once a newer one has replaced it', async () => {
    prisma.jobOffer.findMany.mockResolvedValue([{ ...OFFER, id: 'offer-2' }, OFFER])

    const result = await answerOffer({ ...ANSWER, decision: 'accept' })

    expect(result.ok).toBe(false)
    expect(prisma.jobOffer.updateMany).not.toHaveBeenCalled()
  })

  it('answers only once, even from two tabs', async () => {
    prisma.jobOffer.updateMany.mockResolvedValue({ count: 0 })

    expect(await answerOffer({ ...ANSWER, decision: 'accept' })).toEqual({
      ok: false,
      message: 'You already answered this offer.',
    })
    expect(prisma.applicationEvent.create).not.toHaveBeenCalled()
    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})
