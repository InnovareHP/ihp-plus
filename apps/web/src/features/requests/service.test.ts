import { Code, ConnectError } from '@ihp/rpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  requestSubmission: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  requestForm: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  requestFormTeam: { deleteMany: vi.fn(), createMany: vi.fn() },
  attendanceLeave: { createMany: vi.fn() },
  // The transaction hands back the same mocks, so a write inside one is asserted like any other.
  $transaction: vi.fn(),
  team: { findMany: vi.fn() },
  requestApprover: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
}))

const guard = vi.hoisted(() => ({
  getSession: vi.fn(),
  readProfile: vi.fn(),
  canManageOrganization: vi.fn(() => false),
}))

const notifications = vi.hoisted(() => ({
  notifyApprovers: vi.fn(),
  notifyApproversWithdrawn: vi.fn(),
  notifyRequester: vi.fn(),
  notifyRequesterReceived: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('./notifications', () => notifications)
vi.mock('@/lib/activity', () => activity)

const activity = vi.hoisted(() => ({ recordActivity: vi.fn() }))
// membershipOf is pure, so the real one is kept: how a membership resolves has one definition.
vi.mock('@/lib/auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-guard')>()),
  ...guard,
}))

const {
  decideRequest,
  loadFormsPage,
  saveForm,
  loadMyRequestsPage,
  loadRequest,
  loadRequestsPage,
  submitRequest,
  withdrawRequest,
} = await import('./service')

const PENDING = {
  id: 'sub-1',
  organizationId: 'org-1',
  formId: 'form-1',
  requesterId: 'user-9',
  teamId: 'team-1',
  teamName: 'Revenue Cycle',
  formName: 'Time off',
  fields: [],
  values: {},
  status: 'pending',
  decidedById: null,
  decidedAt: null,
  decisionNote: null,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
}

function signedIn(options: { isAdmin?: boolean; approverTeamIds?: string[] } = {}) {
  guard.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Ada Lovelace' } })
  guard.readProfile.mockResolvedValue({
    preferredName: null,
    role: options.isAdmin ? 'admin' : 'user',
    members: [{ role: options.isAdmin ? 'admin' : 'member', organizationId: 'org-1' }],
    teammembers: [{ team: { id: 'team-2', name: 'Care Management' } }],
  })
  guard.canManageOrganization.mockReturnValue(options.isAdmin ?? false)
  prisma.requestApprover.findMany.mockResolvedValue(
    (options.approverTeamIds ?? []).map((teamId) => ({ teamId })),
  )
}

async function codeOf(operation: () => Promise<unknown>) {
  const error = await operation().catch((thrown: unknown) => thrown)
  return ConnectError.from(error).code
}

const QUERY = { page: 1, pageSize: 25, status: 'pending' as const, teamIds: [], search: '' }

beforeEach(() => {
  vi.clearAllMocks()
  signedIn()
  prisma.requestSubmission.count.mockResolvedValue(1)
  prisma.requestSubmission.findMany.mockResolvedValue([PENDING])
  prisma.requestSubmission.findFirst.mockResolvedValue(PENDING)
  prisma.requestSubmission.update.mockResolvedValue({
    ...PENDING,
    status: 'approved',
    decidedById: 'user-1',
    decidedAt: new Date('2026-06-02T00:00:00.000Z'),
  })
  prisma.user.findMany.mockResolvedValue([
    { id: 'user-9', name: 'Grace Hopper', preferredName: null },
    { id: 'user-1', name: 'Ada Lovelace', preferredName: null },
  ])
  prisma.requestForm.findUnique.mockResolvedValue({ timeOff: false })
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma))
})

describe('the approvals queue', () => {
  it('shows an admin every department, appointed or not', async () => {
    signedIn({ isAdmin: true })

    const page = await loadRequestsPage(QUERY)

    expect(prisma.requestSubmission.findMany.mock.calls[0]?.[0].where).toMatchObject({
      organizationId: 'org-1',
    })
    expect(prisma.requestSubmission.findMany.mock.calls[0]?.[0].where.teamId).toBeUndefined()
    expect(page.rows[0]).toMatchObject({ id: 'sub-1', canDecide: true })
  })

  it('narrows an approver to the departments they were appointed to', async () => {
    signedIn({ approverTeamIds: ['team-1'] })

    await loadRequestsPage(QUERY)

    expect(prisma.requestSubmission.findMany.mock.calls[0]?.[0].where).toMatchObject({
      organizationId: 'org-1',
      teamId: { in: ['team-1'] },
    })
  })

  it('hands an empty page to someone who is neither, rather than an error', async () => {
    const page = await loadRequestsPage(QUERY)

    expect(page.rows).toEqual([])
    expect(prisma.requestSubmission.findMany).not.toHaveBeenCalled()
  })
})

describe('deciding a request', () => {
  it('lets an admin decide a department they were never appointed to', async () => {
    signedIn({ isAdmin: true })

    const row = await decideRequest({
      submissionId: 'sub-1',
      decision: 'approved',
      note: 'Covered.',
    })

    expect(prisma.requestSubmission.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'sub-1' },
      data: { status: 'approved', decidedById: 'user-1', decisionNote: 'Covered.' },
    })
    expect(row).toMatchObject({ status: 'approved' })
  })

  it('lets the appointed approver decide their own department', async () => {
    signedIn({ approverTeamIds: ['team-1'] })

    await decideRequest({
      submissionId: 'sub-1',
      decision: 'rejected',
      note: 'Coverage is short that week.',
    })

    expect(prisma.requestSubmission.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'rejected',
      decisionNote: 'Coverage is short that week.',
    })
  })

  it('refuses a rejection with no reason, whoever sends it', async () => {
    signedIn({ isAdmin: true })

    expect(
      await codeOf(() => decideRequest({ submissionId: 'sub-1', decision: 'rejected', note: '' })),
    ).toBe(Code.InvalidArgument)
    expect(prisma.requestSubmission.update).not.toHaveBeenCalled()
  })

  it('refuses an approver appointed to another department', async () => {
    signedIn({ approverTeamIds: ['team-2'] })

    expect(
      await codeOf(() => decideRequest({ submissionId: 'sub-1', decision: 'approved', note: '' })),
    ).toBe(Code.PermissionDenied)
    expect(prisma.requestSubmission.update).not.toHaveBeenCalled()
  })

  it('refuses an ordinary member outright', async () => {
    expect(
      await codeOf(() => decideRequest({ submissionId: 'sub-1', decision: 'approved', note: '' })),
    ).toBe(Code.PermissionDenied)
    expect(prisma.requestSubmission.update).not.toHaveBeenCalled()
  })

  it('stops an admin deciding their own request', async () => {
    signedIn({ isAdmin: true })
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, requesterId: 'user-1' })

    expect(
      await codeOf(() => decideRequest({ submissionId: 'sub-1', decision: 'approved', note: '' })),
    ).toBe(Code.PermissionDenied)
    expect(prisma.requestSubmission.update).not.toHaveBeenCalled()
  })

  it('refuses a request that was already decided', async () => {
    signedIn({ isAdmin: true })
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, status: 'approved' })

    expect(
      await codeOf(() =>
        decideRequest({ submissionId: 'sub-1', decision: 'rejected', note: 'Too late.' }),
      ),
    ).toBe(Code.FailedPrecondition)
  })

  it('refuses an id from another organization', async () => {
    signedIn({ isAdmin: true })
    prisma.requestSubmission.findFirst.mockResolvedValue(null)

    expect(
      await codeOf(() => decideRequest({ submissionId: 'sub-x', decision: 'approved', note: '' })),
    ).toBe(Code.NotFound)
  })
})

describe('notifications', () => {
  it('asks the department approvers once a request is raised', async () => {
    prisma.requestForm.findFirst.mockResolvedValue({
      id: 'form-1',
      name: 'Time off',
      fields: [],
      status: 'published',
    })
    prisma.requestSubmission.create.mockResolvedValue({
      ...PENDING,
      id: 'sub-2',
      requesterId: 'user-1',
      teamId: 'team-2',
      teamName: 'Care Management',
    })

    await submitRequest({ formId: 'form-1', values: {} })

    const raised = {
      submissionId: 'sub-2',
      organizationId: 'org-1',
      teamId: 'team-2',
      teamName: 'Care Management',
      formName: 'Time off',
      requesterId: 'user-1',
      requesterName: 'Ada Lovelace',
    }
    expect(notifications.notifyApprovers).toHaveBeenCalledWith(raised)
    // The sender gets a receipt from the same raise, not only the approvers.
    expect(notifications.notifyRequesterReceived).toHaveBeenCalledWith(raised)
  })

  it('tells the queue when the requester withdraws, so nobody opens it to decide', async () => {
    signedIn()
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, requesterId: 'user-1' })
    prisma.requestSubmission.update.mockResolvedValue({
      ...PENDING,
      requesterId: 'user-1',
      status: 'withdrawn',
    })

    await withdrawRequest('sub-1')

    expect(notifications.notifyApproversWithdrawn).toHaveBeenCalledWith({
      submissionId: 'sub-1',
      organizationId: 'org-1',
      teamId: 'team-1',
      teamName: 'Revenue Cycle',
      formName: 'Time off',
      requesterId: 'user-1',
      requesterName: 'Ada Lovelace',
    })
  })

  it('tells the requester once their request is decided, with the note', async () => {
    signedIn({ isAdmin: true })

    await decideRequest({ submissionId: 'sub-1', decision: 'approved', note: 'Enjoy the break.' })

    expect(notifications.notifyRequester).toHaveBeenCalledWith({
      submissionId: 'sub-1',
      requesterId: 'user-9',
      formName: 'Time off',
      decision: 'approved',
      deciderName: 'Ada Lovelace',
      note: 'Enjoy the break.',
    })
  })

  it('sends nothing when the decision is refused', async () => {
    signedIn({ isAdmin: true })
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, status: 'approved' })

    await codeOf(() => decideRequest({ submissionId: 'sub-1', decision: 'approved', note: '' }))

    expect(notifications.notifyRequester).not.toHaveBeenCalled()
  })
})

describe('request history', () => {
  it('records the decision with the note that explains it', async () => {
    signedIn({ isAdmin: true })

    await decideRequest({
      submissionId: 'sub-1',
      decision: 'rejected',
      note: 'Those dates overlap the audit.',
    })

    expect(activity.recordActivity).toHaveBeenCalledWith({
      organizationId: 'org-1',
      subjectType: 'request',
      subjectId: 'sub-1',
      action: 'request.rejected',
      actorId: 'user-1',
      actorName: 'Ada Lovelace',
      detail: 'Those dates overlap the audit.',
    })
  })

  it('records a raised request under the person who raised it', async () => {
    prisma.requestForm.findFirst.mockResolvedValue({
      id: 'form-1',
      name: 'Time off',
      fields: [],
      status: 'published',
    })
    prisma.requestSubmission.create.mockResolvedValue({
      ...PENDING,
      id: 'sub-2',
      requesterId: 'user-1',
    })

    await submitRequest({ formId: 'form-1', values: {} })

    expect(activity.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: 'sub-2',
        action: 'request.submitted',
        actorName: 'Ada Lovelace',
      }),
    )
  })
})

describe('reading one request', () => {
  it('opens any request in the organization to an admin', async () => {
    signedIn({ isAdmin: true })

    expect(await loadRequest('sub-1')).toMatchObject({ id: 'sub-1', canDecide: true })
  })

  it('opens a member their own request, without the decision controls', async () => {
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, requesterId: 'user-1' })

    expect(await loadRequest('sub-1')).toMatchObject({ isMine: true, canDecide: false })
  })

  it('keeps someone else out of a request that is not theirs', async () => {
    expect(await codeOf(() => loadRequest('sub-1'))).toBe(Code.PermissionDenied)
  })
})

describe("a requester's own list", () => {
  it("asks the database for one page of the caller's own requests", async () => {
    prisma.requestSubmission.count.mockResolvedValue(64)
    prisma.requestSubmission.findMany.mockResolvedValue([])

    const page = await loadMyRequestsPage({ status: 'all', search: '', page: 3, pageSize: 10 })

    expect(prisma.requestSubmission.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { requesterId: 'user-1' },
      skip: 20,
      take: 10,
    })
    expect(page.pageInfo).toMatchObject({ page: 3, pageCount: 7, hasPrevious: true, hasNext: true })
  })

  it('searches by form name on the server rather than filtering the page in the browser', async () => {
    prisma.requestSubmission.count.mockResolvedValue(0)
    prisma.requestSubmission.findMany.mockResolvedValue([])

    await loadMyRequestsPage({ status: 'pending', search: 'time off', page: 1, pageSize: 25 })

    expect(prisma.requestSubmission.count.mock.calls[0]?.[0].where).toMatchObject({
      status: 'pending',
      formName: { contains: 'time off', mode: 'insensitive' },
    })
  })
})

describe('the forms catalogue', () => {
  beforeEach(() => {
    signedIn({ isAdmin: true })
    prisma.requestForm.count.mockResolvedValue(0)
    prisma.requestForm.findMany.mockResolvedValue([])
    prisma.team.findMany.mockResolvedValue([])
  })

  const FORM_QUERY = {
    kind: 'request' as const,
    search: '',
    status: '',
    teamIds: [],
    unplacedOnly: false,
    page: 1,
    pageSize: 25,
  }

  it('pages the catalogue on the server', async () => {
    prisma.requestForm.count.mockResolvedValue(30)

    const page = await loadFormsPage({ ...FORM_QUERY, page: 2 })

    expect(prisma.requestForm.findMany.mock.calls[0]?.[0]).toMatchObject({ skip: 25, take: 25 })
    expect(page.pageInfo).toMatchObject({ page: 2, total: 30, pageCount: 2, hasNext: false })
  })

  it('takes every filter into the query, including the one for a form nobody is offered', async () => {
    await loadFormsPage({
      ...FORM_QUERY,
      search: 'leave',
      status: 'published',
      unplacedOnly: true,
    })

    expect(prisma.requestForm.count.mock.calls[0]?.[0].where).toMatchObject({
      kind: 'request',
      status: 'published',
      teams: { none: {} },
    })
  })

  it('keeps the forms of one department to that department', async () => {
    await loadFormsPage({ ...FORM_QUERY, teamIds: ['team-1'] })

    expect(prisma.requestForm.count.mock.calls[0]?.[0].where).toMatchObject({
      teams: { some: { teamId: { in: ['team-1'] } } },
    })
  })
})

describe('time off', () => {
  const RANGE = { 'time-off-first-day': '2026-10-05', 'time-off-last-day': '2026-10-07' }

  it('books every day of an approved range as leave for the requester', async () => {
    signedIn({ isAdmin: true })
    prisma.requestForm.findUnique.mockResolvedValue({ timeOff: true })
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, values: RANGE })

    await decideRequest({ submissionId: 'sub-1', decision: 'approved', note: '' })

    expect(prisma.attendanceLeave.createMany).toHaveBeenCalledWith({
      data: ['2026-10-05', '2026-10-06', '2026-10-07'].map((date) => ({
        organizationId: 'org-1',
        userId: 'user-9',
        date: new Date(`${date}T00:00:00.000Z`),
        name: 'Time off',
        submissionId: 'sub-1',
      })),
      skipDuplicates: true,
    })
  })

  it('books nothing when the request is rejected', async () => {
    signedIn({ isAdmin: true })
    prisma.requestForm.findUnique.mockResolvedValue({ timeOff: true })
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, values: RANGE })

    await decideRequest({ submissionId: 'sub-1', decision: 'rejected', note: 'Short that week.' })

    expect(prisma.attendanceLeave.createMany).not.toHaveBeenCalled()
  })

  it('books nothing for an ordinary request', async () => {
    signedIn({ isAdmin: true })
    prisma.requestSubmission.findFirst.mockResolvedValue({ ...PENDING, values: RANGE })

    await decideRequest({ submissionId: 'sub-1', decision: 'approved', note: '' })

    expect(prisma.attendanceLeave.createMany).not.toHaveBeenCalled()
  })

  it('refuses to approve dates that cannot be booked, and leaves the request pending', async () => {
    signedIn({ isAdmin: true })
    prisma.requestForm.findUnique.mockResolvedValue({ timeOff: true })
    prisma.requestSubmission.findFirst.mockResolvedValue({
      ...PENDING,
      values: { 'time-off-first-day': '2026-10-07', 'time-off-last-day': '2026-10-05' },
    })

    expect(
      await codeOf(() => decideRequest({ submissionId: 'sub-1', decision: 'approved', note: '' })),
    ).toBe(Code.FailedPrecondition)
    expect(prisma.requestSubmission.update).not.toHaveBeenCalled()
  })

  it('refuses a range that ends before it starts when it is raised', async () => {
    const fields = [
      {
        id: 'time-off-first-day',
        type: 'date',
        label: 'First day off',
        help: '',
        placeholder: '',
        required: true,
        options: [],
      },
      {
        id: 'time-off-last-day',
        type: 'date',
        label: 'Last day off',
        help: '',
        placeholder: '',
        required: true,
        options: [],
      },
    ]
    prisma.requestForm.findFirst.mockResolvedValue({
      id: 'form-1',
      name: 'Time off',
      fields,
      timeOff: true,
    })

    const error = await submitRequest({
      formId: 'form-1',
      values: { 'time-off-first-day': '2026-10-07', 'time-off-last-day': '2026-10-05' },
    }).catch((thrown: unknown) => ConnectError.from(thrown))

    expect(error).toMatchObject({
      code: Code.InvalidArgument,
      rawMessage: 'The last day off cannot be before the first.',
    })
    expect(prisma.requestSubmission.create).not.toHaveBeenCalled()
  })

  it('puts the two date questions first on a time off form, whatever the client sent', async () => {
    signedIn({ isAdmin: true })
    prisma.requestForm.create.mockResolvedValue({ id: 'form-1' })
    prisma.requestForm.findUniqueOrThrow.mockResolvedValue({
      id: 'form-1',
      kind: 'request',
      name: 'Vacation leave',
      description: '',
      status: 'draft',
      fields: [],
      teams: [],
      timeOff: true,
      updatedAt: new Date('2026-09-24T00:00:00.000Z'),
      _count: { submissions: 0, evaluations: 0 },
    })
    prisma.team.findMany.mockResolvedValue([])

    await saveForm({
      kind: 'request',
      name: 'Vacation leave',
      description: '',
      fields: [
        {
          id: 'why',
          type: 'textarea',
          label: 'Anything to add?',
          help: '',
          placeholder: '',
          required: false,
          options: [],
        },
      ],
      teamIds: [],
      timeOff: true,
    })

    const saved = prisma.requestForm.create.mock.calls[0]?.[0].data
    expect(saved.timeOff).toBe(true)
    expect(saved.fields.map((field: { id: string }) => field.id)).toEqual([
      'time-off-first-day',
      'time-off-last-day',
      'why',
    ])
  })

  it('will not flip a form people have already used', async () => {
    signedIn({ isAdmin: true })
    prisma.requestForm.findFirst.mockResolvedValue({ timeOff: false, _count: { submissions: 2 } })

    expect(
      await codeOf(() =>
        saveForm({
          formId: 'form-1',
          kind: 'request',
          name: 'Vacation leave',
          description: '',
          fields: [],
          teamIds: [],
          timeOff: true,
        }),
      ),
    ).toBe(Code.FailedPrecondition)
    expect(prisma.requestForm.update).not.toHaveBeenCalled()
  })
})
