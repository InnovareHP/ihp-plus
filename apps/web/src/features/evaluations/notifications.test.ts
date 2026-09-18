import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }))

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: vi.fn(),
  evaluationAssignedTemplate: vi.fn(),
  evaluationSubmittedTemplate: vi.fn(),
  evaluationCancelledTemplate: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', () => email)

const { notifyAssigner, notifyEvaluatorCancelled } = await import('./notifications')

const SUBMITTED = {
  evaluationId: 'ev-1',
  assignedById: 'user-admin',
  evaluatorId: 'user-evaluator',
  evaluatorName: 'Ada Lovelace',
  employeeId: 'user-employee',
  formName: 'Annual review',
}

beforeEach(() => {
  vi.resetAllMocks()
  email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
  email.evaluationSubmittedTemplate.mockReturnValue({ subject: 'Back', html: '<p/>', text: '' })
  email.evaluationCancelledTemplate.mockReturnValue({ subject: 'Off', html: '<p/>', text: '' })
  prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === 'user-employee'
      ? { name: 'Grace Hopper', preferredName: null }
      : { email: `${where.id}@ihp.test`, name: where.id, preferredName: null },
  )
})

describe('notifyAssigner', () => {
  it('reports the answers back to whoever asked for them', async () => {
    await notifyAssigner(SUBMITTED)

    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-admin@ihp.test' }),
    )
    expect(email.evaluationSubmittedTemplate).toHaveBeenCalledWith({
      evaluatorName: 'Ada Lovelace',
      employeeName: 'Grace Hopper',
      formName: 'Annual review',
      url: 'https://portal.ihp.test/app/evaluations/view/ev-1',
    })
  })

  it('stays quiet when the evaluator assigned it to themselves', async () => {
    await notifyAssigner({ ...SUBMITTED, assignedById: 'user-evaluator' })

    expect(email.sendEmail).not.toHaveBeenCalled()
  })

  it('stays quiet for a row that records nobody as the assigner', async () => {
    await notifyAssigner({ ...SUBMITTED, assignedById: null })

    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})

describe('notifyEvaluatorCancelled', () => {
  it('tells the evaluator to stop, naming who cancelled it', async () => {
    await notifyEvaluatorCancelled({
      evaluatorId: 'user-evaluator',
      employeeId: 'user-employee',
      formName: 'Annual review',
      cancelledByName: 'Grace Hopper',
    })

    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-evaluator@ihp.test' }),
    )
    expect(email.evaluationCancelledTemplate).toHaveBeenCalledWith({
      formName: 'Annual review',
      employeeName: 'Grace Hopper',
      cancelledByName: 'Grace Hopper',
      url: 'https://portal.ihp.test/app/evaluations',
    })
  })

  it('logs rather than throws, since the cancellation already stands', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.user.findUnique.mockRejectedValue(new Error('connection reset'))

    await expect(
      notifyEvaluatorCancelled({
        evaluatorId: 'user-evaluator',
        employeeId: 'user-employee',
        formName: 'Annual review',
        cancelledByName: 'Grace Hopper',
      }),
    ).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
