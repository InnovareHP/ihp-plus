import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { TaskSubtaskRow } from '../schema'
import { SubtaskList } from './subtask-list'

const SUBTASKS: TaskSubtaskRow[] = [
  { id: 'subtask-1', name: 'Pull last year’s figures', isDone: true, position: 1024 },
  { id: 'subtask-2', name: 'Draft the cover letter', isDone: false, position: 2048 },
]

const handlers = {
  onAdd: vi.fn(async () => {}),
  onToggle: vi.fn(),
  onDelete: vi.fn(),
}

function renderList(subtasks: TaskSubtaskRow[] = SUBTASKS) {
  return render(<SubtaskList subtasks={subtasks} isAdding={false} {...handlers} />)
}

describe('SubtaskList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('says how much of the work is done', () => {
    renderList()

    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
  })

  it('invites the first subtask rather than showing an empty box', () => {
    renderList([])

    expect(screen.getByText(/Break the work down/)).toBeInTheDocument()
  })

  it('ticks a subtask off', async () => {
    const user = userEvent.setup()
    renderList()

    await user.click(screen.getByRole('checkbox', { name: 'Draft the cover letter' }))

    expect(handlers.onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'subtask-2' }),
      true,
    )
  })

  it('adds one and clears the field for the next', async () => {
    const user = userEvent.setup()
    renderList()

    await user.type(screen.getByLabelText('Add a subtask'), 'Book the courier')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(handlers.onAdd).toHaveBeenCalledWith('Book the courier'))
    expect(screen.getByLabelText('Add a subtask')).toHaveValue('')
  })

  it('refuses an empty subtask and announces why', async () => {
    const user = userEvent.setup()
    renderList()

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Say what has to be done.')
    expect(handlers.onAdd).not.toHaveBeenCalled()
  })

  it('keeps what was typed when the server refuses it', async () => {
    const user = userEvent.setup()
    handlers.onAdd.mockRejectedValueOnce(new Error('That task no longer exists.'))
    renderList()

    await user.type(screen.getByLabelText('Add a subtask'), 'Book the courier')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That task no longer exists.')
    expect(screen.getByLabelText('Add a subtask')).toHaveValue('Book the courier')
  })

  it('deletes one', async () => {
    const user = userEvent.setup()
    renderList()

    await user.click(screen.getByRole('button', { name: 'Delete Draft the cover letter' }))

    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'subtask-2' }))
  })

  it('has no axe violations', async () => {
    const { container } = renderList()

    expect(await axe(container)).toHaveNoViolations()
  })
})
