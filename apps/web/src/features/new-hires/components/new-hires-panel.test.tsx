import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { ChecklistSetup, NewHireRow } from '../schema'
import { NewHiresPanel } from './new-hires-panel'

const actions = vi.hoisted(() => ({
  getMyChecklist: vi.fn(),
  markTaskDone: vi.fn(),
  getNewHires: vi.fn(),
  closeNewHireChecklist: vi.fn(),
  getChecklistSetup: vi.fn(),
  requireDocument: vi.fn(),
  unrequireDocument: vi.fn(),
  createChecklistTask: vi.fn(),
  removeChecklistTask: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))
const undo = vi.hoisted(() => ({ offerUndo: vi.fn(), UNDO_WINDOW_MS: 8000 }))
const nav = vi.hoisted(() => ({ searchParams: new URLSearchParams('tab=onboarding') }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))
vi.mock('@/lib/undo', () => undo)
vi.mock('next/navigation', () => ({
  usePathname: () => '/organization',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => nav.searchParams,
}))

const PROGRESS: NewHireRow['progress'] = {
  profile: { done: true, missing: [] },
  reading: {
    done: false,
    documents: [
      { id: 'doc-handbook', title: 'Handbook', acknowledged: true },
      { id: 'doc-safety', title: 'Safety policy', acknowledged: false },
    ],
  },
  shift: { done: false, shiftName: undefined },
  tasks: { done: true, items: [] },
}

const ADA: NewHireRow = {
  userId: 'user-ada',
  name: 'Ada Lovelace',
  jobTitle: 'Data Analyst',
  teamName: 'IT',
  startedAt: '2026-09-20T00:00:00.000Z',
  completedAt: undefined,
  closedByAdmin: false,
  progress: PROGRESS,
  doneCount: 2,
  stuckOn: 'reading',
}

const GRACE: NewHireRow = {
  ...ADA,
  userId: 'user-grace',
  name: 'Grace Hopper',
  progress: { ...PROGRESS, reading: { done: true, documents: [] } },
  doneCount: 3,
  stuckOn: 'shift',
}

const FINISHED: NewHireRow = {
  ...ADA,
  userId: 'user-alan',
  name: 'Alan Turing',
  completedAt: '2026-09-22T00:00:00.000Z',
  doneCount: 4,
  stuckOn: undefined,
}

const SETUP: ChecklistSetup = {
  requiredDocuments: [
    { documentId: 'doc-handbook', title: 'Handbook', audience: 'All departments' },
  ],
  availableDocuments: [{ id: 'doc-safety', title: 'Safety policy' }],
  tasks: [{ id: 'task-laptop', title: 'Collect your laptop', description: 'From IT' }],
}

const user = () => userEvent.setup()

beforeEach(() => {
  vi.clearAllMocks()
  nav.searchParams = new URLSearchParams('tab=onboarding')
  actions.getNewHires.mockResolvedValue({ ok: true, data: [ADA, GRACE, FINISHED] })
  actions.getChecklistSetup.mockResolvedValue({ ok: true, data: SETUP })
  actions.closeNewHireChecklist.mockResolvedValue({ ok: true, data: null })
  actions.requireDocument.mockResolvedValue({ ok: true, data: null })
  actions.removeChecklistTask.mockResolvedValue({ ok: true, data: null })
})

describe('NewHiresPanel — who is stuck where', () => {
  it('lists the hires still settling in, with the step each is stuck on', async () => {
    render(<NewHiresPanel />)

    const ada = await screen.findByRole('row', { name: /Ada Lovelace/ })
    expect(within(ada).getByText('2 of 4 steps')).toBeInTheDocument()
    expect(within(ada).getByText('Waiting on them')).toBeInTheDocument()
    expect(within(ada).getByText(/Reading 1\/2/)).toBeInTheDocument()

    const grace = screen.getByRole('row', { name: /Grace Hopper/ })
    expect(within(grace).getByText('Waiting on an admin')).toBeInTheDocument()

    // Finished checklists are out of the default view.
    expect(screen.queryByRole('row', { name: /Alan Turing/ })).not.toBeInTheDocument()
  })

  it('narrows to hires stuck on one step from the URL', async () => {
    nav.searchParams = new URLSearchParams('tab=onboarding&stuckOn=shift')
    render(<NewHiresPanel />)

    expect(await screen.findByRole('row', { name: /Grace Hopper/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Ada Lovelace/ })).not.toBeInTheDocument()
  })

  it('links straight to the member row to assign a missing shift', async () => {
    const person = user()
    render(<NewHiresPanel />)

    await person.click(await screen.findByRole('button', { name: 'Actions for Grace Hopper' }))

    expect(await screen.findByRole('menuitem', { name: 'Assign a shift' })).toHaveAttribute(
      'href',
      '/organization?tab=members&search=Grace%20Hopper',
    )
  })

  it('closes a checklist at once and commits only when the undo lapses', async () => {
    const person = user()
    render(<NewHiresPanel />)

    await person.click(await screen.findByRole('button', { name: 'Actions for Ada Lovelace' }))
    await person.click(await screen.findByRole('menuitem', { name: 'Close checklist' }))

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Ada Lovelace/ })).not.toBeInTheDocument(),
    )
    expect(actions.closeNewHireChecklist).not.toHaveBeenCalled()

    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
    await waitFor(() =>
      expect(actions.closeNewHireChecklist).toHaveBeenCalledWith({ userId: 'user-ada' }),
    )
  })

  it('puts the row back when the undo is taken', async () => {
    const person = user()
    render(<NewHiresPanel />)

    await person.click(await screen.findByRole('button', { name: 'Actions for Ada Lovelace' }))
    await person.click(await screen.findByRole('menuitem', { name: 'Close checklist' }))
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Ada Lovelace/ })).not.toBeInTheDocument(),
    )

    undo.offerUndo.mock.calls[0]?.[0]?.onUndo()

    expect(await screen.findByRole('row', { name: /Ada Lovelace/ })).toBeInTheDocument()
    expect(actions.closeNewHireChecklist).not.toHaveBeenCalled()
  })
})

describe('NewHiresPanel — what the checklist asks', () => {
  it('adds a document to the required reading before the server answers', async () => {
    let answer: (value: { ok: true; data: null }) => void = () => {}
    actions.requireDocument.mockReturnValue(new Promise((done) => (answer = done)))
    const person = user()
    render(<NewHiresPanel />)

    await person.click(await screen.findByRole('combobox', { name: 'Bluebook document' }))
    await person.click(await screen.findByRole('option', { name: 'Safety policy' }))
    await person.click(screen.getByRole('button', { name: 'Require it' }))

    const reading = screen.getByRole('table', { name: 'Required reading' })
    expect(within(reading).getByText('Safety policy')).toBeInTheDocument()
    expect(actions.requireDocument).toHaveBeenCalledWith({ documentId: 'doc-safety' })
    answer({ ok: true, data: null })
  })

  it('takes a task back off and says why when the server refuses it', async () => {
    actions.createChecklistTask.mockResolvedValue({ ok: false, message: 'Keep it shorter' })
    const person = user()
    render(<NewHiresPanel />)

    await person.type(await screen.findByRole('textbox', { name: /^Task/ }), 'Meet your lead')
    await person.click(screen.getByRole('button', { name: 'Add task' }))

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Could not add that task — Keep it shorter' }),
      ),
    )
    const tasks = screen.getByRole('table', { name: 'First-day tasks' })
    expect(within(tasks).queryByText('Meet your lead')).not.toBeInTheDocument()
  })

  it('requires a name before adding a task', async () => {
    const person = user()
    render(<NewHiresPanel />)

    await person.click(await screen.findByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Name the task')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Task/ })).toHaveAttribute('aria-invalid', 'true')
    expect(actions.createChecklistTask).not.toHaveBeenCalled()
  })

  it('removes a task with an undo instead of a confirm', async () => {
    const person = user()
    render(<NewHiresPanel />)

    await person.click(
      await screen.findByRole('button', { name: 'Actions for Collect your laptop' }),
    )
    await person.click(await screen.findByRole('menuitem', { name: 'Remove task' }))

    await waitFor(() => expect(screen.queryByText('Collect your laptop')).not.toBeInTheDocument())
    undo.offerUndo.mock.calls[0]?.[0]?.onCommit()
    await waitFor(() =>
      expect(actions.removeChecklistTask).toHaveBeenCalledWith({ taskId: 'task-laptop' }),
    )
  })

  it('has no axe violations', async () => {
    const { container } = render(<NewHiresPanel />)
    await screen.findByRole('row', { name: /Ada Lovelace/ })
    await screen.findByRole('table', { name: 'First-day tasks' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
