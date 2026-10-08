import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { TimeClockChecks } from './time-clock-checks'

const actions = vi.hoisted(() => ({
  loadChecklist: vi.fn(),
  runRound: vi.fn(),
  recordCheck: vi.fn(),
}))
const rpc = vi.hoisted(() => ({
  getTimeClock: vi.fn(),
  getAttendanceSettings: vi.fn(),
  updateAttendanceSettings: vi.fn(),
  listAttendance: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  startBreak: vi.fn(),
  endBreak: vi.fn(),
}))
const toast = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@/features/attendance/rpc', () => rpc)
vi.mock('@mantine/notifications', () => ({ notifications: toast }))

const CHECKED = {
  httpStatus: 200,
  responseMs: 300,
  error: '',
  note: '',
  checkedByName: 'Ada Lovelace',
  checkedAt: new Date().toISOString(),
}

function site(id: string, name: string, checks: Record<string, unknown>) {
  return { id, name, url: `https://${id}.example`, clientId: '', clientName: '', notes: '', checks }
}

function clockedIn(at: string) {
  return { today: { isOpen: true, clockInAt: at, clockOutAt: undefined } }
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.getTimeClock.mockResolvedValue(clockedIn(new Date(Date.now() - 60 * 60 * 1000).toISOString()))
})

describe('TimeClockChecks', () => {
  it('shows how the round went and names the sites that are not running', async () => {
    actions.loadChecklist.mockResolvedValue({
      ok: true,
      data: {
        date: '2026-10-09',
        today: '2026-10-09',
        timeZone: 'UTC',
        websites: [
          site('a', 'Riverside site', { clock_in: { ...CHECKED, status: 'up' } }),
          site('b', 'Harbor clinic', {
            clock_in: { ...CHECKED, status: 'down', httpStatus: 502, responseMs: 40 },
          }),
        ],
      },
    })
    const { container } = render(<TimeClockChecks />)

    expect(await screen.findByText('Harbor clinic')).toBeInTheDocument()
    expect(screen.getByText('Down')).toBeInTheDocument()
    expect(screen.getByText('HTTP 502 in 40 ms')).toBeInTheDocument()
    expect(screen.getByText('1 running, 0 with issues, 1 down')).toBeInTheDocument()
    expect(screen.queryByText('Riverside site')).not.toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('says the check is under way right after the lead clocks in', async () => {
    rpc.getTimeClock.mockResolvedValue(clockedIn(new Date().toISOString()))
    actions.loadChecklist.mockResolvedValue({
      ok: true,
      data: {
        date: '2026-10-09',
        today: '2026-10-09',
        timeZone: 'UTC',
        websites: [site('a', 'Riverside site', {})],
      },
    })
    render(<TimeClockChecks />)

    expect(await screen.findByRole('status')).toHaveTextContent('Checking every site now')
  })

  it('lets the lead run the round again', async () => {
    const list = {
      ok: true,
      data: {
        date: '2026-10-09',
        today: '2026-10-09',
        timeZone: 'UTC',
        websites: [site('a', 'Riverside site', { clock_in: { ...CHECKED, status: 'up' } })],
      },
    }
    actions.loadChecklist.mockResolvedValue(list)
    actions.runRound.mockResolvedValue(list)
    const user = userEvent.setup()
    render(<TimeClockChecks />)

    await user.click(await screen.findByRole('button', { name: 'Run time in check again' }))
    expect(actions.runRound).toHaveBeenCalledWith({ round: 'clock_in' })
  })

  it('points to the page when there is nothing to check yet', async () => {
    actions.loadChecklist.mockResolvedValue({
      ok: true,
      data: { date: '2026-10-09', today: '2026-10-09', timeZone: 'UTC', websites: [] },
    })
    render(<TimeClockChecks />)

    expect(await screen.findByText(/No client websites on the list yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open website checks' })).toBeInTheDocument()
  })
})
