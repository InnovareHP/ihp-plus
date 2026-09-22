import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { UNDO_WINDOW_MS } from '@/lib/undo'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { TaskBoard } from './task-board'

const rpc = vi.hoisted(() => ({
  getTimeSettings: vi.fn(),
  listTimeEntries: vi.fn(),
  getRunningTimer: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  logTime: vi.fn(),
  deleteTimeEntry: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  listLists: vi.fn(),
  createList: vi.fn(),
  listStatuses: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  reorderTask: vi.fn(),
  deleteTask: vi.fn(),
  listConversation: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  deleteAttachment: vi.fn(),
}))

const actions = vi.hoisted(() => ({ uploadTaskAttachment: vi.fn() }))

const toast = vi.hoisted(() => ({ show: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))
const candidates = vi.hoisted(() => ({ useEvaluationCandidates: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('../actions', () => actions)
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: { user: { id: 'user-1', name: 'Dana Reyes' } } }),
}))
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('@/features/evaluations/hooks/use-evaluations', () => candidates)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/tasks',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const STATUSES = [
  { id: 'status-todo', name: 'To do', color: '#95E5DC', category: 'active' as const, sortOrder: 1 },
  { id: 'status-done', name: 'Done', color: '#15803d', category: 'done' as const, sortOrder: 2 },
]

const PROJECT = {
  id: 'project-1',
  name: 'Onboarding revamp',
  color: undefined,
  isArchived: false,
  taskCount: 1,
}
const LIST = { id: 'list-1', projectId: 'project-1', name: 'This week', sortOrder: 1 }

const TASK = {
  id: 'task-1',
  taskNumber: 1,
  name: 'Send the renewal pack',
  description: '',
  priority: 'normal' as const,
  projectId: 'project-1',
  listId: 'list-1',
  statusId: 'status-todo',
  status: STATUSES[0]!,
  assignees: [],
  startDate: undefined,
  dueDate: undefined,
  completedAt: undefined,
  isArchived: false,
  position: 1024,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  commentCount: 2,
  attachmentCount: 1,
  trackedSeconds: 0,
  parentId: undefined,
  subtasks: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.getTimeSettings.mockResolvedValue({
    settings: {
      allowManualEntry: true,
      allowSelfEdit: true,
      requireNote: false,
      trackOnlyAssigned: false,
      autoStopHours: 12,
    },
    canManage: false,
  })
  rpc.listTimeEntries.mockResolvedValue({ entries: [], totalSeconds: 0 })
  rpc.getRunningTimer.mockResolvedValue(undefined)
  // The board view is the default; these cases are about the list, so they ask for it.
  nav.search = 'view=list'
  rpc.listProjects.mockResolvedValue([PROJECT])
  rpc.listLists.mockResolvedValue([LIST])
  rpc.listStatuses.mockResolvedValue(STATUSES)
  rpc.listTasks.mockResolvedValue([TASK])
  rpc.listConversation.mockResolvedValue({ comments: [], attachments: [] })
  candidates.useEvaluationCandidates.mockReturnValue({
    data: [{ userId: 'user-2', name: 'Grace Hopper', email: 'grace@example.com' }],
  })
})

async function renderBoard() {
  const view = render(<TaskBoard />)
  expect(await screen.findByText('Send the renewal pack')).toBeInTheDocument()
  return view
}

describe('TaskBoard', () => {
  it('shows the project, its lists and the work inside them', async () => {
    await renderBoard()

    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getAllByText('1 task')).toHaveLength(2)
    expect(screen.getByText('#1')).toBeInTheDocument()
  })

  it('folds a status group away and back', async () => {
    const user = userEvent.setup()
    await renderBoard()

    const toggle = screen.getByRole('button', { name: /To do/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByText('Send the renewal pack')).not.toBeVisible())

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('starts a done status collapsed and keeps its work separate', async () => {
    rpc.listTasks.mockResolvedValue([
      TASK,
      {
        ...TASK,
        id: 'task-2',
        taskNumber: 2,
        name: 'Archive the old pack',
        statusId: 'status-done',
        status: STATUSES[1]!,
      },
    ])

    await renderBoard()

    expect(screen.getByRole('button', { name: /Done/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /To do/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('offers the first project as a starting point when there are none', async () => {
    rpc.listProjects.mockResolvedValue([])

    render(<TaskBoard />)

    expect(await screen.findByText('Start your first project')).toBeInTheDocument()
  })

  it('reports a board that could not load and retries', async () => {
    rpc.listTasks.mockRejectedValueOnce(new Error('Could not reach the server.'))

    render(<TaskBoard />)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Could not reach the server.')).toBeInTheDocument()

    rpc.listTasks.mockResolvedValue([TASK])
    rpc.listConversation.mockResolvedValue({ comments: [], attachments: [] })
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Send the renewal pack')).toBeInTheDocument()
  })

  it('paints a new task before the server answers', async () => {
    const user = userEvent.setup()
    let settle = (): void => {}
    rpc.createTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = () => resolve({ ...TASK, id: 'task-2', taskNumber: 2, name: 'Book the kickoff' })
        }),
    )

    await renderBoard()
    await user.click(screen.getByRole('button', { name: 'New task' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.type(
      dialog.getByRole('textbox', { name: /what has to be done/i }),
      'Book the kickoff',
    )
    await user.click(dialog.getByRole('button', { name: 'Add task' }))

    // The row is on the board while the call is still in flight.
    expect(await screen.findByText('Book the kickoff')).toBeInTheDocument()

    rpc.listTasks.mockResolvedValue([
      TASK,
      { ...TASK, id: 'task-2', taskNumber: 2, name: 'Book the kickoff' },
    ])
    settle()
    await waitFor(() => expect(rpc.createTask).toHaveBeenCalledTimes(1))
  })

  // Mantine's FileButton hides its input, so the picker is found by type rather than by label.
  function filePicker() {
    return document.querySelector('input[type="file"]') as HTMLInputElement
  }

  it('sends a file up once the task it belongs to exists', async () => {
    const user = userEvent.setup()
    rpc.createTask.mockResolvedValue({
      ...TASK,
      id: 'task-2',
      taskNumber: 2,
      name: 'Book the kickoff',
    })
    actions.uploadTaskAttachment.mockResolvedValue({ ok: true, data: { id: 'file-1' } })

    await renderBoard()
    await user.click(screen.getByRole('button', { name: 'New task' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.type(
      dialog.getByRole('textbox', { name: /what has to be done/i }),
      'Book the kickoff',
    )

    const file = new File(['agenda'], 'agenda.png', { type: 'image/png' })
    await user.upload(filePicker(), file)
    expect(await screen.findByText('agenda.png')).toBeInTheDocument()
    // Nothing is stored while the task is still a form.
    expect(actions.uploadTaskAttachment).not.toHaveBeenCalled()

    await user.click(dialog.getByRole('button', { name: 'Add task' }))

    await waitFor(() => expect(actions.uploadTaskAttachment).toHaveBeenCalledTimes(1))
    const body = actions.uploadTaskAttachment.mock.calls[0]?.[0] as FormData
    expect(body.get('taskId')).toBe('task-2')
  })

  it('turns away a file the bucket would refuse, before it travels', async () => {
    const user = userEvent.setup()

    await renderBoard()
    await user.click(screen.getByRole('button', { name: 'New task' }))
    const dialog = within(await screen.findByRole('dialog'))

    const file = new File(['x'], 'macro.exe', { type: 'application/x-msdownload' })
    await user.upload(filePicker(), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Attach a PDF, Office document, text file or image.',
    )
    expect(actions.uploadTaskAttachment).not.toHaveBeenCalled()
  })

  it('restores the board and says why when completing a task fails', async () => {
    const user = userEvent.setup()
    rpc.completeTask.mockRejectedValue(new Error('Could not save that — try again.'))

    await renderBoard()
    const checkbox = screen.getByRole('checkbox', { name: 'Complete Send the renewal pack' })
    await user.click(checkbox)

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Could not save that — try again.' }),
      ),
    )
    expect(
      screen.getByRole('checkbox', { name: 'Complete Send the renewal pack' }),
    ).not.toBeChecked()
  })

  it('opens the task, and its conversation, from a row in the list view', async () => {
    const user = userEvent.setup()
    await renderBoard()

    await user.click(screen.getByRole('button', { name: 'Send the renewal pack' }))

    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining('task=task-1'),
      expect.anything(),
    )
  })

  it('says on the row that a task carries a conversation', async () => {
    await renderBoard()

    expect(screen.getByLabelText('2 comments')).toBeInTheDocument()
    expect(screen.getByLabelText('1 files')).toBeInTheDocument()
  })

  it('reads its filters out of the URL', async () => {
    nav.search = 'view=list&priority=urgent,high&due=overdue&person=user-2&status=status-todo'

    await renderBoard()

    expect(rpc.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        priorities: ['urgent', 'high'],
        due: 'overdue',
        assigneeUserId: 'user-2',
        statusId: 'status-todo',
      }),
    )
  })

  it('polls itself, because someone else moves the cards on a shared board', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await renderBoard()
      expect(rpc.listTasks).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(61 * 1000)

      await waitFor(() => expect(rpc.listTasks).toHaveBeenCalledTimes(2))
    } finally {
      vi.useRealTimers()
    }
  })

  it('deletes at once and offers the way back, rather than asking first', async () => {
    const user = userEvent.setup()
    rpc.deleteTask.mockResolvedValue(undefined)

    await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Actions for Send the renewal pack' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete task' }))

    // The row goes immediately; the server hears about it when the undo window closes.
    await waitFor(() => expect(screen.queryByText('Send the renewal pack')).not.toBeInTheDocument())
    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ autoClose: UNDO_WINDOW_MS }))
    expect(rpc.deleteTask).not.toHaveBeenCalled()
  })

  it('takes a selection out in one go, still undoably', async () => {
    const user = userEvent.setup()
    rpc.deleteTask.mockResolvedValue(undefined)

    await renderBoard()
    await user.click(screen.getByRole('checkbox', { name: 'Select Send the renewal pack' }))

    const bar = within(screen.getByRole('region', { name: '1 selected' }))
    expect(bar.getByText('1 task selected')).toBeInTheDocument()

    await user.click(bar.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('Send the renewal pack')).not.toBeInTheDocument())
  })

  it('has no axe violations', async () => {
    const { container } = await renderBoard()

    expect(await axe(container)).toHaveNoViolations()
  })
})
