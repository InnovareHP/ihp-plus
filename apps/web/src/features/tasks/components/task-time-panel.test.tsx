import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { TaskRow, TaskStatusRow } from '../schema'
import { TaskTimePanel } from './task-time-panel'

const rpc = vi.hoisted(() => ({
  getTimeSettings: vi.fn(),
  listTimeEntries: vi.fn(),
  getRunningTimer: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  logTime: vi.fn(),
  deleteTimeEntry: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))

const STATUS: TaskStatusRow = {
  id: 'status-todo',
  name: 'To do',
  color: '#95E5DC',
  category: 'active',
  sortOrder: 1,
}

const TASK: TaskRow = {
  id: 'task-1',
  taskNumber: 14,
  name: 'Send the renewal pack',
  description: '',
  priority: 'normal',
  projectId: 'project-1',
  listId: 'list-1',
  statusId: 'status-todo',
  status: STATUS,
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
  trackedSeconds: 5400,
  parentId: undefined,
  subtasks: [],
}

const RULES = {
  allowManualEntry: true,
  allowSelfEdit: true,
  requireNote: false,
  trackOnlyAssigned: false,
  autoStopHours: 12,
}

const ENTRY = {
  id: 'entry-1',
  taskId: 'task-1',
  userId: 'user-1',
  userName: 'Dana Reyes',
  startedAt: '2026-09-21T09:00:00.000Z',
  endedAt: '2026-09-21T10:30:00.000Z',
  seconds: 5400,
  note: 'Drafting the cover letter',
  isRunning: false,
}

function renderPanel() {
  return render(<TaskTimePanel task={TASK} viewerId="user-1" />)
}

describe('TaskTimePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getTimeSettings.mockResolvedValue({ settings: RULES, canManage: false })
    rpc.listTimeEntries.mockResolvedValue({ entries: [ENTRY], totalSeconds: 5400 })
    rpc.getRunningTimer.mockResolvedValue(undefined)
    rpc.startTimer.mockResolvedValue({ ...ENTRY, id: 'entry-2', isRunning: true })
    rpc.stopTimer.mockResolvedValue(ENTRY)
    rpc.logTime.mockResolvedValue(ENTRY)
    rpc.deleteTimeEntry.mockResolvedValue(undefined)
  })

  it('totals the hours in words, not in seconds', async () => {
    renderPanel()

    // The heading is the task's total; the same figure on the entry below it is that one entry.
    expect(await screen.findByRole('heading', { name: '1h 30m' })).toBeInTheDocument()
  })

  it('starts the clock on this task', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Start timer' }))

    await waitFor(() => expect(rpc.startTimer).toHaveBeenCalledWith('task-1'))
  })

  it('says where the clock already is, before it is moved', async () => {
    rpc.getRunningTimer.mockResolvedValue({
      entry: { ...ENTRY, id: 'entry-9', taskId: 'task-2', endedAt: undefined, isRunning: true },
      taskName: 'Chase the signature',
      taskNumber: 15,
      projectId: 'project-1',
    })

    renderPanel()

    expect(await screen.findByText(/Chase the signature/)).toBeInTheDocument()
  })

  it('offers to stop the one running here', async () => {
    const user = userEvent.setup()
    rpc.getRunningTimer.mockResolvedValue({
      entry: { ...ENTRY, id: 'entry-9', endedAt: undefined, isRunning: true },
      taskName: TASK.name,
      taskNumber: 14,
      projectId: 'project-1',
    })

    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Stop timer' }))

    await waitFor(() => expect(rpc.stopTimer).toHaveBeenCalled())
  })

  it('takes time typed the way people say it', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(await screen.findByLabelText('Log time'), '1h 30m')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(rpc.logTime).toHaveBeenCalledWith(expect.objectContaining({ seconds: 5400 })),
    )
  })

  it('refuses what is not a duration, and says what to type', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(await screen.findByLabelText('Log time'), 'soon')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Try 45m, 1h 30m or 1.5h.')
    expect(rpc.logTime).not.toHaveBeenCalled()
  })

  it('hides the manual form when the organization tracks with the timer only', async () => {
    rpc.getTimeSettings.mockResolvedValue({
      settings: { ...RULES, allowManualEntry: false },
      canManage: false,
    })

    renderPanel()

    expect(
      await screen.findByText('Your organization records time with the timer only.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Log time')).not.toBeInTheDocument()
  })

  it('offers no delete on an entry the rules say stands', async () => {
    rpc.getTimeSettings.mockResolvedValue({
      settings: { ...RULES, allowSelfEdit: false },
      canManage: false,
    })

    renderPanel()
    await screen.findByText('Drafting the cover letter')

    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
  })

  it('removes an entry of your own when that is allowed', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Delete 1h 30m logged by you' }))

    await waitFor(() => expect(rpc.deleteTimeEntry).toHaveBeenCalledWith('entry-1'))
  })

  it('has no axe violations', async () => {
    const { container } = renderPanel()
    await screen.findByText('Drafting the cover letter')

    expect(await axe(container)).toHaveNoViolations()
  })
})
