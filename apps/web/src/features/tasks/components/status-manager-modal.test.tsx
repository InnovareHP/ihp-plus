import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import type { TaskRow, TaskStatusRow } from '../schema'
import { StatusManagerModal } from './status-manager-modal'

const rpc = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listLists: vi.fn(),
  listStatuses: vi.fn(),
  listTasks: vi.fn(),
  createStatus: vi.fn(),
  updateStatus: vi.fn(),
  reorderStatus: vi.fn(),
  deleteStatus: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const STATUSES: TaskStatusRow[] = [
  { id: 'status-todo', name: 'To do', color: '#95E5DC', category: 'active', sortOrder: 1 },
  { id: 'status-doing', name: 'In progress', color: '#1346C5', category: 'active', sortOrder: 2 },
  { id: 'status-done', name: 'Done', color: '#15803d', category: 'done', sortOrder: 3 },
]

const TASK = {
  id: 'task-1',
  taskNumber: 1,
  name: 'Send the renewal pack',
  description: '',
  priority: 'normal' as const,
  projectId: 'project-1',
  listId: 'list-1',
  statusId: 'status-todo',
  status: STATUSES[0] as TaskStatusRow,
  assignees: [],
  startDate: undefined,
  dueDate: undefined,
  completedAt: undefined,
  isArchived: false,
  position: 1024,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  commentCount: 0,
  attachmentCount: 0,
  parentId: undefined,
  subtasks: [],
} satisfies TaskRow

function renderManager(tasks: TaskRow[] = [TASK]) {
  return render(<StatusManagerModal opened statuses={STATUSES} tasks={tasks} onClose={vi.fn()} />)
}

describe('StatusManagerModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('says what each column means and how much work sits in it', () => {
    renderManager()

    expect(screen.getByText('Open work · 1 here')).toBeInTheDocument()
    expect(screen.getByText('Closes the task · 0 here')).toBeInTheDocument()
  })

  it('moves a column, sending the one it lands before', async () => {
    const user = userEvent.setup()
    rpc.reorderStatus.mockResolvedValue(STATUSES)
    renderManager()

    await user.click(screen.getByRole('button', { name: 'Move In progress left' }))

    await waitFor(() =>
      expect(rpc.reorderStatus).toHaveBeenCalledWith('status-doing', 'status-todo'),
    )
  })

  it('pins the ends of the row, so an order is never ambiguous', () => {
    renderManager()

    expect(screen.getByRole('button', { name: 'Move To do left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Done right' })).toBeDisabled()
  })

  it('renames a column without asking what it means', async () => {
    const user = userEvent.setup()
    rpc.updateStatus.mockResolvedValue({ ...STATUSES[0], name: 'Up next' })
    renderManager()

    await user.click(screen.getByRole('button', { name: 'Rename To do' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Rename column' }))
    await user.clear(dialog.getByLabelText(/Column name/))
    await user.type(dialog.getByLabelText(/Column name/), 'Up next')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(rpc.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: 'status-todo', name: 'Up next' }),
      ),
    )
    // What a column means is set once, when it is created.
    expect(screen.queryByLabelText(/What this column means/)).not.toBeInTheDocument()
  })

  it('asks where the work goes before deleting a column holding any', async () => {
    const user = userEvent.setup()
    rpc.deleteStatus.mockResolvedValue(undefined)
    renderManager()

    await user.click(screen.getByRole('button', { name: 'Delete To do' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete column' }))
    expect(dialog.getByRole('combobox', { name: 'Move its tasks to' })).toBeInTheDocument()

    await user.click(dialog.getByRole('button', { name: 'Delete column' }))

    await waitFor(() =>
      expect(rpc.deleteStatus).toHaveBeenCalledWith('status-todo', 'status-doing'),
    )
  })

  it('does not ask where to move nothing', async () => {
    const user = userEvent.setup()
    rpc.deleteStatus.mockResolvedValue(undefined)
    renderManager()

    await user.click(screen.getByRole('button', { name: 'Delete Done' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete column' }))

    expect(dialog.queryByRole('combobox', { name: 'Move its tasks to' })).not.toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Delete column' }))

    await waitFor(() => expect(rpc.deleteStatus).toHaveBeenCalledWith('status-done', undefined))
  })

  it('says why the server refused a column change', async () => {
    const user = userEvent.setup()
    rpc.createStatus.mockRejectedValue(new Error('A column already goes by that name.'))
    renderManager()

    await user.click(screen.getByRole('button', { name: 'Add column' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'New column' }))
    await user.type(dialog.getByLabelText(/Column name/), 'To do')
    await user.click(dialog.getByRole('button', { name: 'Add column' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A column already goes by that name.',
    )
  })

  it('has no axe violations', async () => {
    const { container } = renderManager()

    expect(await axe(container)).toHaveNoViolations()
  })
})
