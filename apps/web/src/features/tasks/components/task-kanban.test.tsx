import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import type { TaskRow, TaskStatusRow } from '../schema'
import { TaskKanban } from './task-kanban'

const STATUSES: TaskStatusRow[] = [
  { id: 'status-todo', name: 'To do', color: '#95E5DC', category: 'active', sortOrder: 1 },
  { id: 'status-doing', name: 'In progress', color: '#1346C5', category: 'active', sortOrder: 2 },
  { id: 'status-done', name: 'Done', color: '#15803d', category: 'done', sortOrder: 3 },
]

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 'task-1',
    taskNumber: 14,
    name: 'Send the renewal pack',
    description: '',
    priority: 'normal',
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
    trackedSeconds: 0,
    parentId: undefined,
    subtasks: [],
    ...overrides,
  }
}

const handlers = {
  onOpen: vi.fn(),
  onMoveTo: vi.fn(),
  onReorder: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
}

function renderBoard(tasks: TaskRow[]) {
  return render(<TaskKanban statuses={STATUSES} tasks={tasks} {...handlers} />)
}

describe('TaskKanban', () => {
  beforeEach(() => vi.clearAllMocks())

  it('puts each task under the status it holds', () => {
    renderBoard([
      task(),
      task({ id: 'task-2', taskNumber: 15, name: 'Chase the signature', statusId: 'status-done' }),
    ])

    const done = screen.getByRole('region', { name: 'Done, 1 tasks' })
    const todo = screen.getByRole('region', { name: 'To do, 1 tasks' })

    expect(within(done).getByText(/Chase the signature/)).toBeInTheDocument()
    expect(within(todo).getByText(/Send the renewal pack/)).toBeInTheDocument()
  })

  it('moves a card between columns from the keyboard, not only by dragging', async () => {
    const user = userEvent.setup()
    renderBoard([task()])

    await user.click(screen.getByRole('button', { name: 'Actions for Send the renewal pack' }))
    await user.click(screen.getByRole('menuitem', { name: 'In progress' }))

    expect(handlers.onMoveTo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' }),
      'status-doing',
    )
  })

  it('never offers the column a card is already in', async () => {
    const user = userEvent.setup()
    renderBoard([task()])

    await user.click(screen.getByRole('button', { name: 'Actions for Send the renewal pack' }))

    expect(screen.queryByRole('menuitem', { name: 'To do' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Done' })).toBeInTheDocument()
  })

  it('opens the task when its name is clicked', async () => {
    const user = userEvent.setup()
    renderBoard([task()])

    await user.click(screen.getByRole('button', { name: '#14 Send the renewal pack' }))

    expect(handlers.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }))
  })

  it('opens the task when the card itself is clicked, not only its name', async () => {
    const user = userEvent.setup()
    renderBoard([task()])

    await user.click(screen.getByText('Unassigned'))

    expect(handlers.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }))
  })

  it('leaves the card alone when its menu is used', async () => {
    const user = userEvent.setup()
    renderBoard([task()])

    await user.click(screen.getByRole('button', { name: 'Actions for Send the renewal pack' }))

    expect(handlers.onOpen).not.toHaveBeenCalled()
  })

  it('badges the conversation so a card says what is on it', () => {
    renderBoard([task({ commentCount: 3, attachmentCount: 2 })])

    expect(screen.getByLabelText('3 comments')).toBeInTheDocument()
    expect(screen.getByLabelText('2 files')).toBeInTheDocument()
  })

  it('moves a card up its column from the keyboard', async () => {
    const user = userEvent.setup()
    renderBoard([task(), task({ id: 'task-2', taskNumber: 15, name: 'Chase the signature' })])

    await user.click(screen.getByRole('button', { name: 'Actions for Chase the signature' }))
    await user.click(screen.getByRole('menuitem', { name: 'Move up' }))

    // Landing before the card above it is what "up one" means to the server.
    expect(handlers.onReorder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-2' }),
      'status-todo',
      'task-1',
    )
  })

  it('offers no move up on the first card of a column', async () => {
    const user = userEvent.setup()
    renderBoard([task(), task({ id: 'task-2', taskNumber: 15, name: 'Chase the signature' })])

    await user.click(screen.getByRole('button', { name: 'Actions for Send the renewal pack' }))

    expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute(
      'data-disabled',
      'true',
    )
  })

  it("badges how far a card's subtasks have got", () => {
    renderBoard([
      task({
        subtasks: [
          { id: 'subtask-1', name: 'Pull the figures', isDone: true, position: 1024 },
          { id: 'subtask-2', name: 'Draft the letter', isDone: false, position: 2048 },
        ],
      }),
    ])

    expect(screen.getByLabelText('1 of 2 subtasks done')).toBeInTheDocument()
  })

  it('says a column is empty rather than leaving it blank', () => {
    renderBoard([task()])

    expect(screen.getAllByText('Nothing here.')).toHaveLength(2)
  })

  it('has no axe violations', async () => {
    const { container } = renderBoard([task({ commentCount: 1 })])
    expect(await axe(container)).toHaveNoViolations()
  })
})
