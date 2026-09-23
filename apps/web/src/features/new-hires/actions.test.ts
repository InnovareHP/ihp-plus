import { beforeEach, describe, expect, it, vi } from 'vitest'

const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(),
  membershipOf: vi.fn((): { organizationId: string | undefined } => ({ organizationId: 'org-1' })),
  canManageOrganization: vi.fn(() => false),
}))

const service = vi.hoisted(() => ({
  addRequiredDocument: vi.fn(),
  addTask: vi.fn(),
  archiveTask: vi.fn(),
  closeChecklist: vi.fn(),
  listNewHires: vi.fn(),
  loadChecklistFor: vi.fn(),
  loadSetup: vi.fn(),
  removeRequiredDocument: vi.fn(),
  setTaskDone: vi.fn(),
}))

vi.mock('@/lib/auth-guard', () => guard)
vi.mock('./service', () => service)

const {
  closeNewHireChecklist,
  createChecklistTask,
  getMyChecklist,
  getNewHires,
  markTaskDone,
  requireDocument,
} = await import('./actions')

beforeEach(() => {
  vi.clearAllMocks()
  guard.requireOnboarded.mockResolvedValue({ user: { id: 'user-ada' }, profile: {} })
  guard.canManageOrganization.mockReturnValue(false)
  guard.membershipOf.mockReturnValue({ organizationId: 'org-1' })
})

describe('the hire side', () => {
  it('reads the caller own checklist, and none is not an error', async () => {
    service.loadChecklistFor.mockResolvedValue(null)

    expect(await getMyChecklist()).toEqual({ ok: true, data: null })
    expect(service.loadChecklistFor).toHaveBeenCalledWith('org-1', 'user-ada')
  })

  it('ticks a task off for the caller only', async () => {
    service.setTaskDone.mockResolvedValue(true)

    expect(await markTaskDone({ taskId: 'task-laptop', done: true })).toEqual({
      ok: true,
      data: null,
    })
    expect(service.setTaskDone).toHaveBeenCalledWith('org-1', 'user-ada', 'task-laptop', true)
  })

  it('says so when the task has left the list', async () => {
    service.setTaskDone.mockResolvedValue(false)

    expect(await markTaskDone({ taskId: 'task-gone', done: true })).toEqual({
      ok: false,
      message: 'That task is no longer on your checklist.',
    })
  })

  it('rejects a malformed toggle before it reaches the database', async () => {
    expect((await markTaskDone({ taskId: '', done: 'yes' })).ok).toBe(false)
    expect(service.setTaskDone).not.toHaveBeenCalled()
  })
})

describe('the admin side', () => {
  it('keeps the list of new hires from an ordinary member', async () => {
    expect(await getNewHires()).toEqual({
      ok: false,
      message: 'Only an admin can manage the new-hire checklist.',
    })
    expect(service.listNewHires).not.toHaveBeenCalled()
  })

  it('shows an admin every new hire', async () => {
    guard.canManageOrganization.mockReturnValue(true)
    service.listNewHires.mockResolvedValue([])

    expect(await getNewHires()).toEqual({ ok: true, data: [] })
  })

  it('closes a checklist on behalf of the admin who asked', async () => {
    guard.canManageOrganization.mockReturnValue(true)
    service.closeChecklist.mockResolvedValue(true)

    expect((await closeNewHireChecklist({ userId: 'user-grace' })).ok).toBe(true)
    expect(service.closeChecklist).toHaveBeenCalledWith('org-1', 'user-grace', 'user-ada')
  })

  it('refuses a document that is not in the bluebook', async () => {
    guard.canManageOrganization.mockReturnValue(true)
    service.addRequiredDocument.mockResolvedValue(false)

    expect(await requireDocument({ documentId: 'doc-gone' })).toEqual({
      ok: false,
      message: 'That document is no longer in the bluebook.',
    })
  })

  it('names what is wrong with a task before saving it', async () => {
    guard.canManageOrganization.mockReturnValue(true)

    expect(await createChecklistTask({ title: '  ' })).toEqual({
      ok: false,
      message: 'Name the task',
    })
    expect(service.addTask).not.toHaveBeenCalled()
  })
})
