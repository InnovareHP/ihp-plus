import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { TaskBoard } from './task-board'

const rpc = vi.hoisted(() => ({
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
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))
const candidates = vi.hoisted(() => ({ useEvaluationCandidates: vi.fn() }))

vi.mock('../rpc', () => rpc)
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
}

beforeEach(() => {
  vi.clearAllMocks()
  nav.search = ''
  rpc.listProjects.mockResolvedValue([PROJECT])
  rpc.listLists.mockResolvedValue([LIST])
  rpc.listStatuses.mockResolvedValue(STATUSES)
  rpc.listTasks.mockResolvedValue([TASK])
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
    expect(screen.getByText('1 task')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
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

  it('asks before deleting, because a deleted task does not come back', async () => {
    const user = userEvent.setup()
    rpc.deleteTask.mockResolvedValue(undefined)

    await renderBoard()
    await user.click(screen.getByRole('button', { name: 'Actions for Send the renewal pack' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete task' }))
    await user.click(screen.getByRole('button', { name: 'Delete task' }))

    await waitFor(() => expect(rpc.deleteTask).toHaveBeenCalledWith('task-1'))
  })

  it('has no axe violations', async () => {
    const { container } = await renderBoard()

    expect(await axe(container)).toHaveNoViolations()
  })
})
