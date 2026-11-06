import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({ user: { findUnique: vi.fn(), findMany: vi.fn() } }))
const executives = vi.hoisted(() => ({ executiveUserIds: vi.fn() }))

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  portalUrl: vi.fn(),
  evaluationAssignedTemplate: vi.fn(),
  evaluationSubmittedTemplate: vi.fn(),
  evaluationCancelledTemplate: vi.fn(),
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/email', () => email)
vi.mock('./executives', () => executives)

const { notifyEvaluatorCancelled, notifyExecutives } = await import('./notifications')

const SUBMITTED = {
  evaluationId: 'ev-1',
  organizationId: 'org-1',
  evaluatorId: 'user-evaluator',
  employeeId: 'user-employee',
  formName: 'Annual review',
}

beforeEach(() => {
  vi.resetAllMocks()
  email.portalUrl.mockImplementation((route: string) => `https://portal.ihp.test/app${route}`)
  email.evaluationSubmittedTemplate.mockReturnValue({ subject: 'Back', html: '<p/>', text: '' })
  email.evaluationCancelledTemplate.mockReturnValue({ subject: 'Off', html: '<p/>', text: '' })
  prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    email: `${where.id}@ihp.test`,
  }))
})

describe('notifyExecutives', () => {
  beforeEach(() => {
    executives.executiveUserIds.mockResolvedValue(['user-ceo', 'user-coo'])
    prisma.user.findMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ email: `${id}@ihp.test` })),
    )
  })

  it('sends the finished evaluation to each executive, naming nobody in it', async () => {
    await notifyExecutives(SUBMITTED)

    expect(executives.executiveUserIds).toHaveBeenCalledWith('org-1')
    expect(email.sendEmail).toHaveBeenCalledTimes(2)
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-ceo@ihp.test' }),
    )
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-coo@ihp.test' }),
    )
    expect(email.evaluationSubmittedTemplate).toHaveBeenCalledWith({
      formName: 'Annual review',
      url: 'https://portal.ihp.test/app/evaluations/view/ev-1',
    })
  })

  it('never tells the person evaluated, even an executive, nor the evaluator', async () => {
    executives.executiveUserIds.mockResolvedValue(['user-ceo', 'user-employee', 'user-evaluator'])

    await notifyExecutives(SUBMITTED)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['user-ceo'] } } }),
    )
    expect(email.sendEmail).toHaveBeenCalledTimes(1)
    expect(email.sendEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-employee@ihp.test' }),
    )
  })

  it('sends nothing, to anyone else, when the Executive department is empty', async () => {
    executives.executiveUserIds.mockResolvedValue([])
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await notifyExecutives(SUBMITTED)

    expect(email.sendEmail).not.toHaveBeenCalled()
  })
})

describe('notifyEvaluatorCancelled', () => {
  it('tells the evaluator to stop, without naming who it was about', async () => {
    await notifyEvaluatorCancelled({ evaluatorId: 'user-evaluator', formName: 'Annual review' })

    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user-evaluator@ihp.test' }),
    )
    expect(email.evaluationCancelledTemplate).toHaveBeenCalledWith({
      formName: 'Annual review',
      url: 'https://portal.ihp.test/app/evaluations',
    })
  })

  it('logs rather than throws, since the cancellation already stands', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.user.findUnique.mockRejectedValue(new Error('connection reset'))

    await expect(
      notifyEvaluatorCancelled({ evaluatorId: 'user-evaluator', formName: 'Annual review' }),
    ).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })
})
