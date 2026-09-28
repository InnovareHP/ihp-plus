import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  interview: { findFirst: vi.fn() },
  interviewFeedback: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
  hiringSettings: { findUnique: vi.fn() },
  applicationEvent: { create: vi.fn() },
  user: { findMany: vi.fn() },
}))
const access = vi.hoisted(() => ({ requireMemberCaller: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./access', () => access)

const { loadInterviewerView, submitScorecard } = await import('./scorecard-service')
const { DEFAULT_STAGES } = await import('./schema')

const COMMUNICATION = {
  id: 'communication',
  type: 'number',
  label: 'Communication (1 to 5)',
  help: '',
  placeholder: '',
  required: true,
  options: [],
  min: 1,
  max: 5,
}

const INTERVIEW = {
  id: 'int-1',
  organizationId: 'org-1',
  applicationId: 'app-1',
  format: 'video',
  location: '',
  note: '',
  durationMinutes: 45,
  interviewerIds: ['user-lead'],
  status: 'booked',
  bookedStart: new Date('2026-10-14T02:00:00.000Z'),
  bookedEnd: new Date('2026-10-14T02:45:00.000Z'),
  applicantTimeZone: null,
  sequence: 1,
  calendarEventId: null,
  joinUrl: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  slots: [],
  application: {
    id: 'app-1',
    postingId: 'post-1',
    fullName: 'Grace Hopper',
    email: 'grace@example.com',
    phone: '',
    status: 'active',
    stageId: 'interview',
    stageChangedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    fields: [],
    values: {},
    attachments: [],
    posting: {
      title: 'Registered nurse',
      stages: DEFAULT_STAGES,
      scorecardForm: { fields: [COMMUNICATION] },
    },
  },
}

function as(userId: string, canHire = false) {
  access.requireMemberCaller.mockResolvedValue({
    userId,
    name: 'Lee',
    organizationId: 'org-1',
    canHire,
  })
}

async function errorOf(operation: () => Promise<unknown>) {
  return operation().then(
    () => undefined,
    (thrown: unknown) => ConnectError.from(thrown),
  )
}

function score(recommendation: string, communication: number) {
  return () => submitScorecard({ interviewId: 'int-1', recommendation, values: { communication } })
}

beforeEach(() => {
  vi.clearAllMocks()
  as('user-lead')
  prisma.interview.findFirst.mockResolvedValue(INTERVIEW)
  prisma.interviewFeedback.findUnique.mockResolvedValue(null)
  prisma.user.findMany.mockResolvedValue([
    { id: 'user-lead', name: 'Lee', preferredName: null, email: 'lee@ihp.test' },
  ])
  prisma.interviewFeedback.upsert.mockImplementation(async ({ create }) => ({
    ...create,
    updatedAt: new Date('2026-10-14T03:00:00.000Z'),
  }))
})

describe('who sees an interview', () => {
  it('shows it to its interviewer, who may score it', async () => {
    const view = await loadInterviewerView('int-1')

    expect(view.canScore).toBe(true)
    expect(view.scorecardFields.map((field) => field.id)).toEqual(['communication'])
    expect(view.applicant).toMatchObject({ fullName: 'Grace Hopper', stageName: 'Interview' })
  })

  it('shows it to HR, read-only, and to nobody else', async () => {
    as('user-hr', true)
    expect((await loadInterviewerView('int-1')).canScore).toBe(false)

    as('user-other', false)
    expect((await errorOf(() => loadInterviewerView('int-1')))?.code).toBe(Code.NotFound)
  })
})

describe('scoring', () => {
  it('keeps the questions as they were asked beside the answers and the verdict', async () => {
    const saved = await score('strong_yes', 5)()

    expect(prisma.interviewFeedback.upsert.mock.calls[0]?.[0].create).toMatchObject({
      interviewId: 'int-1',
      interviewerId: 'user-lead',
      recommendation: 'strong_yes',
      fields: [expect.objectContaining({ id: 'communication' })],
      values: { communication: 5 },
    })
    expect(saved.recommendation).toBe('strong_yes')
    expect(prisma.applicationEvent.create.mock.calls[0]?.[0].data.kind).toBe('scorecard_submitted')
  })

  it('records the history once, not on every later change', async () => {
    prisma.interviewFeedback.findUnique.mockResolvedValue({ id: 'fb-1' })

    await score('yes', 4)()

    expect(prisma.applicationEvent.create).not.toHaveBeenCalled()
  })

  it('checks the answers and the verdict on the server', async () => {
    expect((await errorOf(score('yes', 9)))?.code).toBe(Code.InvalidArgument)
    expect((await errorOf(score('maybe', 3)))?.code).toBe(Code.InvalidArgument)
    expect(prisma.interviewFeedback.upsert).not.toHaveBeenCalled()
  })

  it('lets only the people on the interview score it, and only once it is booked', async () => {
    as('user-hr', true)
    expect((await errorOf(score('yes', 3)))?.code).toBe(Code.PermissionDenied)

    as('user-lead')
    prisma.interview.findFirst.mockResolvedValue({ ...INTERVIEW, status: 'offered' })
    expect((await errorOf(score('yes', 3)))?.code).toBe(Code.FailedPrecondition)
  })
})
