import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  evaluationAssignment: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  requestForm: { findFirst: vi.fn() },
  member: { findMany: vi.fn() },
  teamMember: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
}))

const guard = vi.hoisted(() => ({
  getSession: vi.fn(),
  readProfile: vi.fn(),
  canManageOrganization: vi.fn(() => false),
}))

const notifications = vi.hoisted(() => ({
  notifyAssigner: vi.fn(),
  notifyEvaluator: vi.fn(),
  notifyEvaluatorCancelled: vi.fn(),
}))
const activity = vi.hoisted(() => ({ recordActivity: vi.fn() }))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./notifications', () => notifications)
vi.mock('@/lib/activity', () => activity)
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  assignEvaluations,
  cancelEvaluation,
  loadEvaluation,
  loadMyEvaluationsPage,
  submitEvaluation,
} = await import('./service')

const RATING = {
  id: 'rating',
  type: 'number' as const,
  label: 'Overall rating',
  help: '',
  required: true,
  options: [],
  min: 1,
  max: 5,
}

const FORM = {
  id: 'form-1',
  organizationId: 'org-1',
  kind: 'evaluation',
  status: 'published',
  name: 'Probationary review',
  fields: [RATING],
}

const PENDING = {
  id: 'eval-1',
  organizationId: 'org-1',
  employeeId: 'user-9',
  evaluatorId: 'user-1',
  assignedById: 'user-2',
  formId: 'form-1',
  formName: 'Probationary review',
  fields: [RATING],
  values: {},
  status: 'pending',
  dueAt: null,
  submittedAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
}

function signedIn(options: { isAdmin?: boolean; userId?: string } = {}) {
  guard.getSession.mockResolvedValue({ user: { id: options.userId ?? 'user-1', name: 'Ada' } })
  guard.readProfile.mockResolvedValue({
    preferredName: null,
    role: options.isAdmin ? 'admin' : 'user',
    members: [{ role: options.isAdmin ? 'admin' : 'member', organizationId: 'org-1' }],
    teammembers: [{ team: { id: 'team-1', name: 'Care Management' } }],
  })
  guard.canManageOrganization.mockReturnValue(options.isAdmin ?? false)
}

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

const ASSIGNMENT = {
  formId: 'form-1',
  evaluatorId: 'user-1',
  employeeIds: ['user-9'],
  dueAt: '2026-10-01',
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn()
  prisma.requestForm.findFirst.mockResolvedValue(FORM)
  prisma.evaluationAssignment.findFirst.mockResolvedValue(PENDING)
  prisma.evaluationAssignment.findMany.mockResolvedValue([])
  prisma.evaluationAssignment.create.mockResolvedValue(PENDING)
  prisma.evaluationAssignment.update.mockResolvedValue({ ...PENDING, status: 'submitted' })
  prisma.member.findMany.mockImplementation(
    async ({ where }: { where: { userId?: { in: string[] } } }) =>
      (where.userId?.in ?? []).map((userId) => ({ userId })),
  )
  prisma.user.findMany.mockResolvedValue([
    {
      id: 'user-1',
      name: 'Ada Lovelace',
      preferredName: null,
      employmentStatus: null,
      teammembers: [],
    },
    {
      id: 'user-9',
      name: 'Grace Hopper',
      preferredName: null,
      employmentStatus: 'Probationary',
      teammembers: [{ team: { name: 'Care Management' } }],
    },
  ])
})

describe('assigning an evaluation', () => {
  beforeEach(() => signedIn({ isAdmin: true, userId: 'user-2' }))

  it('snapshots the form and emails the evaluator once for the batch', async () => {
    const rows = await assignEvaluations(ASSIGNMENT)

    expect(prisma.evaluationAssignment.create.mock.calls[0]?.[0].data).toMatchObject({
      organizationId: 'org-1',
      employeeId: 'user-9',
      evaluatorId: 'user-1',
      formName: 'Probationary review',
      fields: [RATING],
    })
    expect(notifications.notifyEvaluator).toHaveBeenCalledTimes(1)
    expect(rows[0]).toMatchObject({
      employeeName: 'Grace Hopper',
      employeeEmploymentStatus: 'Probationary',
      status: 'pending',
    })
  })

  it('refuses anyone who cannot manage the organization', async () => {
    signedIn()

    expect(await codeOf(() => assignEvaluations(ASSIGNMENT))).toBe(Code.PermissionDenied)
    expect(prisma.evaluationAssignment.create).not.toHaveBeenCalled()
  })

  it('refuses a form that is not a published evaluation', async () => {
    prisma.requestForm.findFirst.mockResolvedValue(null)

    expect(await codeOf(() => assignEvaluations(ASSIGNMENT))).toBe(Code.FailedPrecondition)
  })

  it('refuses when everyone picked already has one waiting', async () => {
    prisma.evaluationAssignment.findMany.mockResolvedValue([{ employeeId: 'user-9' }])

    expect(await codeOf(() => assignEvaluations(ASSIGNMENT))).toBe(Code.FailedPrecondition)
    expect(prisma.evaluationAssignment.create).not.toHaveBeenCalled()
  })

  it('assigns the rest when only some already have one waiting', async () => {
    prisma.evaluationAssignment.findMany.mockResolvedValue([{ employeeId: 'user-9' }])

    await assignEvaluations({ ...ASSIGNMENT, employeeIds: ['user-9', 'user-8'] })

    expect(prisma.evaluationAssignment.create).toHaveBeenCalledTimes(1)
    expect(prisma.evaluationAssignment.create.mock.calls[0]?.[0].data).toMatchObject({
      employeeId: 'user-8',
    })
  })

  it('refuses a supervisor evaluating themselves', async () => {
    expect(await codeOf(() => assignEvaluations({ ...ASSIGNMENT, employeeIds: ['user-1'] }))).toBe(
      Code.InvalidArgument,
    )
  })
})

describe('filling one in', () => {
  it('saves the answers, stamps the time and needs no approver', async () => {
    await submitEvaluation({ evaluationId: 'eval-1', values: { rating: 4 } })

    // Whoever asked for it hears it came back, which is the only signal they get.
    expect(notifications.notifyAssigner).toHaveBeenCalledWith({
      evaluationId: 'eval-1',
      assignedById: 'user-2',
      evaluatorId: 'user-1',
      evaluatorName: 'Ada',
      employeeId: 'user-9',
      formName: 'Probationary review',
    })

    const data = prisma.evaluationAssignment.update.mock.calls[0]?.[0].data
    expect(data).toMatchObject({ status: 'submitted', values: { rating: 4 } })
    expect(data.submittedAt).toBeInstanceOf(Date)
  })

  it('validates the answers against the snapshot, not the live form', async () => {
    expect(
      await codeOf(() => submitEvaluation({ evaluationId: 'eval-1', values: { rating: 9 } })),
    ).toBe(Code.InvalidArgument)
    expect(prisma.evaluationAssignment.update).not.toHaveBeenCalled()
  })

  it('refuses anyone but the evaluator', async () => {
    signedIn({ userId: 'user-7' })

    expect(
      await codeOf(() => submitEvaluation({ evaluationId: 'eval-1', values: { rating: 4 } })),
    ).toBe(Code.PermissionDenied)
  })

  it('refuses one that has already been submitted', async () => {
    prisma.evaluationAssignment.findFirst.mockResolvedValue({ ...PENDING, status: 'submitted' })

    expect(
      await codeOf(() => submitEvaluation({ evaluationId: 'eval-1', values: { rating: 4 } })),
    ).toBe(Code.FailedPrecondition)
  })
})

describe('reading one', () => {
  it('lets the evaluator read it', async () => {
    const row = await loadEvaluation('eval-1')

    expect(row).toMatchObject({ id: 'eval-1', canFill: true, isMine: true })
  })

  it('lets an admin read it without being the evaluator', async () => {
    signedIn({ isAdmin: true, userId: 'user-2' })

    expect(await loadEvaluation('eval-1')).toMatchObject({ canFill: false, isMine: false })
  })

  it('keeps it from everyone else', async () => {
    signedIn({ userId: 'user-7' })

    expect(await codeOf(() => loadEvaluation('eval-1'))).toBe(Code.PermissionDenied)
  })
})

describe('cancelling and listing', () => {
  it('cancels only one nobody has filled in', async () => {
    signedIn({ isAdmin: true, userId: 'user-2' })
    prisma.evaluationAssignment.findFirst.mockResolvedValue({ ...PENDING, status: 'submitted' })

    expect(await codeOf(() => cancelEvaluation('eval-1'))).toBe(Code.FailedPrecondition)
  })

  it('tells the evaluator when an admin cancels what they were asked to fill in', async () => {
    signedIn({ isAdmin: true, userId: 'user-2' })
    prisma.evaluationAssignment.update.mockResolvedValue({ ...PENDING, status: 'cancelled' })

    await cancelEvaluation('eval-1')

    expect(notifications.notifyEvaluatorCancelled).toHaveBeenCalledWith({
      evaluatorId: 'user-1',
      employeeId: 'user-9',
      formName: 'Probationary review',
      cancelledByName: 'Ada',
    })
  })

  it('lists only the evaluations the caller has to fill in', async () => {
    prisma.evaluationAssignment.count.mockResolvedValue(1)
    prisma.evaluationAssignment.findMany.mockResolvedValue([PENDING])

    const page = await loadMyEvaluationsPage({
      status: 'pending',
      search: '',
      page: 1,
      pageSize: 25,
    })

    expect(prisma.evaluationAssignment.findMany.mock.calls[0]?.[0].where).toMatchObject({
      evaluatorId: 'user-1',
      organizationId: 'org-1',
      status: 'pending',
    })
    // The page the server reports is what the footer counts, not the rows it happened to return.
    expect(page.pageInfo).toMatchObject({ page: 1, pageSize: 25, total: 1, pageCount: 1 })
  })

  it('asks the database for only the rows on the page', async () => {
    prisma.evaluationAssignment.count.mockResolvedValue(140)
    prisma.evaluationAssignment.findMany.mockResolvedValue([])

    const page = await loadMyEvaluationsPage({ status: 'all', search: '', page: 3, pageSize: 25 })

    expect(prisma.evaluationAssignment.findMany.mock.calls[0]?.[0]).toMatchObject({
      skip: 50,
      take: 25,
    })
    expect(page.pageInfo).toMatchObject({ page: 3, pageCount: 6, hasPrevious: true, hasNext: true })
  })
})
