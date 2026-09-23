import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { NewHireChecklistView } from '../schema'
import { FirstDaysChecklist } from './first-days-checklist'

const actions = vi.hoisted(() => ({ getMyChecklist: vi.fn(), markTaskDone: vi.fn() }))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const VIEW: NewHireChecklistView = {
  startedAt: '2026-09-20T00:00:00.000Z',
  completedAt: undefined,
  profile: { done: false, missing: ['phone'] },
  reading: {
    done: false,
    documents: [
      { id: 'doc-handbook', title: 'Employee handbook', acknowledged: true },
      { id: 'doc-safety', title: 'Safety policy', acknowledged: false },
    ],
  },
  shift: { done: false, shiftName: undefined },
  tasks: {
    done: false,
    items: [
      { id: 'task-laptop', title: 'Collect your laptop', description: 'From IT', done: false },
    ],
  },
}

function deferred() {
  let resolve: (value: { ok: true; data: null }) => void = () => {}
  const promise = new Promise<{ ok: true; data: null }>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('FirstDaysChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.getMyChecklist.mockResolvedValue({ ok: true, data: VIEW })
  })

  it('lays out the four steps with what each one still needs', () => {
    render(<FirstDaysChecklist initial={VIEW} />)

    expect(screen.getByRole('heading', { name: 'Your first days' })).toBeInTheDocument()
    expect(screen.getByText('0 of 4 done')).toBeInTheDocument()
    expect(screen.getByText(/Add a phone number/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open settings' })).toBeInTheDocument()
    expect(screen.getByText(/1 of 2 to go/)).toBeInTheDocument()
    expect(screen.getByText('Safety policy')).toBeInTheDocument()
    expect(screen.getByText('Waiting on People & Culture')).toBeInTheDocument()
  })

  it('ticks a task off before the server answers', async () => {
    const pending = deferred()
    actions.markTaskDone.mockReturnValue(pending.promise)
    const person = userEvent.setup()
    render(<FirstDaysChecklist initial={VIEW} />)

    await person.click(screen.getByRole('checkbox', { name: /Collect your laptop/ }))

    expect(screen.getByRole('checkbox', { name: /Collect your laptop/ })).toBeChecked()
    expect(actions.markTaskDone).toHaveBeenCalledWith({ taskId: 'task-laptop', done: true })
    pending.resolve({ ok: true, data: null })
  })

  it('unticks the task and says why when the server refuses', async () => {
    actions.markTaskDone.mockResolvedValue({
      ok: false,
      message: 'That task is no longer on your checklist.',
    })
    const person = userEvent.setup()
    render(<FirstDaysChecklist initial={VIEW} />)

    await person.click(screen.getByRole('checkbox', { name: /Collect your laptop/ }))

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Collect your laptop/ })).not.toBeChecked(),
    )
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'red',
        message: 'Could not update that task — That task is no longer on your checklist.',
      }),
    )
  })

  it('celebrates a finished checklist instead of listing it', () => {
    render(<FirstDaysChecklist initial={{ ...VIEW, completedAt: '2026-09-24T00:00:00.000Z' }} />)

    expect(screen.getByRole('status')).toHaveTextContent('You are all set')
    expect(screen.queryByRole('heading', { name: 'Your first days' })).not.toBeInTheDocument()
  })

  it('shows nothing to someone who is not a new hire', () => {
    actions.getMyChecklist.mockResolvedValue({ ok: true, data: null })
    render(<FirstDaysChecklist initial={null} />)

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<FirstDaysChecklist initial={VIEW} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
