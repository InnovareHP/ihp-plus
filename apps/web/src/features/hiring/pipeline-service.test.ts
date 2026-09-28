import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  jobApplication: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  applicationAttachment: { findFirst: vi.fn(), findMany: vi.fn() },
  applicationEvent: { create: vi.fn(), findMany: vi.fn() },
  applicationNote: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  organization: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))
const access = vi.hoisted(() => ({ requireHiringCaller: vi.fn(), requireMemberCaller: vi.fn() }))
const scorecards = vi.hoisted(() => ({
  scorecardsOf: vi.fn(async () => []),
  interviewsApplicant: vi.fn(async () => false),
}))
const notifications = vi.hoisted(() => ({ notifyStageMessage: vi.fn(), notifyRejected: vi.fn() }))
const s3 = vi.hoisted(() => ({ objectUrl: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)
vi.mock('./scorecard-service', () => scorecards)
vi.mock('./notifications', () => notifications)
vi.mock('@/lib/s3', () => s3)
// Interviews have their own tests; here an application simply has none.
vi.mock('./interviews', () => ({ interviewsOf: vi.fn(async () => []) }))

process.env.BETTER_AUTH_SECRET = 'test-secret'

const {
  attachmentDownloadUrl,
  deleteNote,
  loadApplication,
  moveApplication,
  rejectApplication,
  reopenApplication,
} = await import('./pipeline-service')
const { DEFAULT_STAGES } = await import('./schema')

const APPLICATION = {
  id: 'app-1',
  organizationId: 'org-1',
  postingId: 'post-1',
  postingTitle: 'Registered nurse',
  fullName: 'Grace Hopper',
  email: 'grace@example.com',
  phone: '',
  fields: [],
  values: {},
  status: 'active',
  stageId: 'applied',
  stageChangedAt: new Date('2026-09-20T10:00:00.000Z'),
  rejectionReason: null,
  createdAt: new Date('2026-09-20T10:00:00.000Z'),
  updatedAt: new Date('2026-09-20T10:00:00.000Z'),
  posting: { stages: DEFAULT_STAGES, title: 'Registered nurse', slug: 'registered-nurse-abc123' },
  attachments: [{ id: 'file-resume' }],
}

async function errorOf(operation: () => Promise<unknown>) {
  return operation().then(
    () => undefined,
    (thrown: unknown) => ConnectError.from(thrown),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  access.requireHiringCaller.mockResolvedValue({
    userId: 'user-hr',
    name: 'Rita HR',
    organizationId: 'org-1',
    isAdmin: false,
  })
  prisma.jobApplication.findFirst.mockResolvedValue(APPLICATION)
  prisma.jobApplication.findUniqueOrThrow.mockResolvedValue(APPLICATION)
  prisma.organization.findUnique.mockResolvedValue({ name: 'IHP+' })
  prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  )
})

describe('moving an applicant', () => {
  it('moves them, records who did it, and emails the stage message', async () => {
    await moveApplication({
      applicationId: 'app-1',
      stageId: 'interview',
      sendEmail: true,
      message: '',
    })

    expect(prisma.jobApplication.update.mock.calls[0]?.[0].data.stageId).toBe('interview')
    expect(prisma.applicationEvent.create).toHaveBeenCalledWith({
      data: {
        applicationId: 'app-1',
        actorId: 'user-hr',
        kind: 'moved',
        detail: {
          fromStageId: 'applied',
          toStageId: 'interview',
          toStageName: 'Interview',
          emailed: true,
        },
      },
    })
    // Nothing was rewritten, so the stage's own message is what goes out.
    expect(notifications.notifyStageMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'grace@example.com',
        message: DEFAULT_STAGES[2]?.message,
        statusUrl: expect.stringContaining('/careers/status/app-1/'),
      }),
    )
  })

  it('sends the rewritten message instead when HR changed it for this person', async () => {
    await moveApplication({
      applicationId: 'app-1',
      stageId: 'interview',
      sendEmail: true,
      message: 'Can you do Tuesday at 10?',
    })

    expect(notifications.notifyStageMessage.mock.calls[0]?.[0].message).toBe(
      'Can you do Tuesday at 10?',
    )
  })

  it('moves quietly into a stage with no message, even when asked to email', async () => {
    await moveApplication({
      applicationId: 'app-1',
      stageId: 'screening',
      sendEmail: true,
      message: '',
    })

    expect(notifications.notifyStageMessage).not.toHaveBeenCalled()
    expect(prisma.applicationEvent.create.mock.calls[0]?.[0].data.detail.emailed).toBe(false)
  })

  it('refuses the stage they are already in, a stage the posting lacks, and a decided applicant', async () => {
    expect(
      (
        await errorOf(() =>
          moveApplication({
            applicationId: 'app-1',
            stageId: 'applied',
            sendEmail: false,
            message: '',
          }),
        )
      )?.code,
    ).toBe(Code.FailedPrecondition)

    expect(
      (
        await errorOf(() =>
          moveApplication({
            applicationId: 'app-1',
            stageId: 'ghost',
            sendEmail: false,
            message: '',
          }),
        )
      )?.code,
    ).toBe(Code.NotFound)

    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, status: 'rejected' })
    expect(
      (
        await errorOf(() =>
          moveApplication({
            applicationId: 'app-1',
            stageId: 'offer',
            sendEmail: false,
            message: '',
          }),
        )
      )?.code,
    ).toBe(Code.FailedPrecondition)
    expect(prisma.jobApplication.update).not.toHaveBeenCalled()
  })

  it('only looks inside the caller’s own organization', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue(null)

    expect(
      (
        await errorOf(() =>
          moveApplication({
            applicationId: 'app-1',
            stageId: 'offer',
            sendEmail: false,
            message: '',
          }),
        )
      )?.code,
    ).toBe(Code.NotFound)
    expect(prisma.jobApplication.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'app-1',
      organizationId: 'org-1',
    })
  })
})

describe('deciding', () => {
  it('rejects with the reason kept for the team and the message sent to the applicant', async () => {
    await rejectApplication({
      applicationId: 'app-1',
      reason: 'Needs a current licence',
      sendEmail: true,
      message: 'Thank you for applying.',
    })

    expect(prisma.jobApplication.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Needs a current licence',
      decidedById: 'user-hr',
    })
    expect(notifications.notifyRejected).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Thank you for applying.', email: 'grace@example.com' }),
    )
  })

  it('rejects without a word when asked not to email', async () => {
    await rejectApplication({ applicationId: 'app-1', reason: '', sendEmail: false, message: '' })

    expect(notifications.notifyRejected).not.toHaveBeenCalled()
  })

  it('refuses an email with nothing in it', async () => {
    const error = await errorOf(() =>
      rejectApplication({ applicationId: 'app-1', reason: '', sendEmail: true, message: '' }),
    )

    expect(error?.code).toBe(Code.InvalidArgument)
    expect(prisma.jobApplication.update).not.toHaveBeenCalled()
  })

  it('reopens a rejection, but never a withdrawal', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, status: 'rejected' })
    await reopenApplication('app-1')
    expect(prisma.jobApplication.update.mock.calls[0]?.[0].data.status).toBe('active')

    prisma.jobApplication.findFirst.mockResolvedValue({ ...APPLICATION, status: 'withdrawn' })
    expect((await errorOf(() => reopenApplication('app-1')))?.code).toBe(Code.FailedPrecondition)
  })
})

describe('reading an application', () => {
  it('tells its history from the names stored at the time', async () => {
    prisma.applicationAttachment.findMany.mockResolvedValue([])
    prisma.applicationNote.findMany.mockResolvedValue([
      { id: 'note-1', authorId: 'user-hr', body: 'Strong call.', createdAt: new Date() },
    ])
    prisma.applicationEvent.findMany.mockResolvedValue([
      { id: 'e1', kind: 'applied', actorId: null, detail: {}, createdAt: new Date() },
      {
        id: 'e2',
        kind: 'moved',
        actorId: 'user-hr',
        // The stage has since been renamed; the history keeps what it was called.
        detail: { toStageName: 'Phone screen', emailed: true },
        createdAt: new Date(),
      },
    ])
    prisma.user.findMany.mockResolvedValue([{ id: 'user-hr', name: 'Rita', preferredName: null }])

    const detail = await loadApplication('app-1')

    expect(detail.events.map((event) => [event.label, event.actorName, event.detail])).toEqual([
      ['Applied through the careers page', undefined, undefined],
      ['Moved to Phone screen', 'Rita', 'Emailed the applicant'],
    ])
    expect(detail.notes[0]).toMatchObject({ authorName: 'Rita', isMine: true })
    expect(detail.summary).toMatchObject({ stageName: 'Applied', hasResume: true })
  })
})

describe('notes and files', () => {
  it('lets only the author delete a note', async () => {
    prisma.applicationNote.findFirst.mockResolvedValue({ id: 'note-1', authorId: 'someone-else' })

    expect((await errorOf(() => deleteNote('note-1')))?.code).toBe(Code.PermissionDenied)
    expect(prisma.applicationNote.delete).not.toHaveBeenCalled()
  })

  it('signs a download only for a file that belongs to a sent application here', async () => {
    access.requireMemberCaller.mockResolvedValue({
      userId: 'user-hr',
      organizationId: 'org-1',
      canHire: true,
    })
    prisma.applicationAttachment.findFirst.mockResolvedValue({
      fileKey: 'hiring/org-1/post-1/cv.pdf',
      applicationId: 'app-1',
    })
    s3.objectUrl.mockResolvedValue('https://storage.test/signed')

    expect(await attachmentDownloadUrl('file-resume')).toBe('https://storage.test/signed')
    expect(prisma.applicationAttachment.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'file-resume',
      organizationId: 'org-1',
      applicationId: { not: null },
    })
  })

  it('lets an interviewer open the files of someone they interview, and nobody else', async () => {
    access.requireMemberCaller.mockResolvedValue({
      userId: 'user-lead',
      organizationId: 'org-1',
      canHire: false,
    })
    prisma.applicationAttachment.findFirst.mockResolvedValue({
      fileKey: 'k',
      applicationId: 'app-1',
    })
    s3.objectUrl.mockResolvedValue('https://storage.test/signed')

    scorecards.interviewsApplicant.mockResolvedValue(true)
    expect(await attachmentDownloadUrl('file-resume')).toBe('https://storage.test/signed')
    expect(scorecards.interviewsApplicant).toHaveBeenCalledWith('user-lead', 'app-1')

    scorecards.interviewsApplicant.mockResolvedValue(false)
    expect((await errorOf(() => attachmentDownloadUrl('file-resume')))?.code).toBe(Code.NotFound)
  })
})
