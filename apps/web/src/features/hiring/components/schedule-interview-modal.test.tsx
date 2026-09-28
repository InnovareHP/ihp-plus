import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { ApplicationSummary } from '../schema'
import { ScheduleInterviewModal } from './schedule-interview-modal'

const browser = vi.hoisted(() => ({
  hiring: {
    listInterviewers: vi.fn(),
    offerInterview: vi.fn(),
    suggestSlots: vi.fn(),
  },
}))

// Mocked at the transport, so the real rpc module turns HR's wall clock into instants.
vi.mock('@/rpc/browser', () => ({ browserClients: browser }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

const APPLICATION = { id: 'app-1', fullName: 'Grace Hopper' } as ApplicationSummary

function renderModal(onClose = vi.fn(), calendarConnected = false) {
  return render(
    <ScheduleInterviewModal
      application={APPLICATION}
      timeZone="Asia/Manila"
      calendarConnected={calendarConnected}
      onClose={onClose}
    />,
  )
}

// Two free times on the first day, then one on each of the next three, all in the future.
const FREE = [
  '2030-10-14T01:00:00.000Z',
  '2030-10-14T03:00:00.000Z',
  '2030-10-15T06:00:00.000Z',
  '2030-10-16T02:00:00.000Z',
  '2030-10-17T02:00:00.000Z',
]

async function pickRita(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Interviewers/, { selector: 'input' }))
  await user.click(await screen.findByRole('option', { name: 'Rita Santos' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  browser.hiring.listInterviewers.mockResolvedValue({
    people: [{ userId: 'user-hr', name: 'Rita Santos', email: 'rita@ihp.test' }],
  })
})

describe('ScheduleInterviewModal with Outlook connected', () => {
  beforeEach(() => {
    browser.hiring.suggestSlots.mockResolvedValue({
      slots: FREE.map((start) => ({ start, end: start })),
      fromCalendar: true,
    })
  })

  it('fills in three free times on different days as soon as interviewers are picked', async () => {
    const user = userEvent.setup()
    const { baseElement } = renderModal(vi.fn(), true)

    await pickRita(user)

    await waitFor(() => expect(screen.getByLabelText(/Day, option 3/)).toHaveValue('2030-10-16'))
    expect(screen.getByLabelText(/Day, option 1/)).toHaveValue('2030-10-14')
    expect(screen.getByLabelText(/Time, option 1/)).toHaveValue('09:00')
    expect(screen.getByLabelText(/Day, option 2/)).toHaveValue('2030-10-15')
    expect(screen.getByLabelText(/Time, option 2/)).toHaveValue('14:00')
    expect(screen.queryByLabelText(/Day, option 4/)).not.toBeInTheDocument()
    expect(browser.hiring.suggestSlots).toHaveBeenCalledTimes(1)
    expect(await axe(baseElement)).toHaveNoViolations()
  })

  it('leaves times HR typed alone', async () => {
    const user = userEvent.setup()
    renderModal(vi.fn(), true)

    await user.type(screen.getByLabelText(/Day, option 1/), '2030-11-02')
    await user.type(screen.getByLabelText(/Time, option 1/), '15:30')
    await pickRita(user)

    await waitFor(() => expect(browser.hiring.suggestSlots).toHaveBeenCalled())
    expect(screen.getByLabelText(/Day, option 1/)).toHaveValue('2030-11-02')
    expect(screen.queryByLabelText(/Day, option 2/)).not.toBeInTheDocument()
  })

  it('fills every day over typed times when HR asks for it', async () => {
    const user = userEvent.setup()
    renderModal(vi.fn(), true)

    await user.type(screen.getByLabelText(/Day, option 1/), '2030-11-02')
    await user.type(screen.getByLabelText(/Time, option 1/), '15:30')
    await pickRita(user)
    await user.click(await screen.findByRole('button', { name: 'Fill in free days' }))

    expect(screen.getByLabelText(/Day, option 1/)).toHaveValue('2030-10-14')
    expect(screen.getByLabelText(/Day, option 2/)).toHaveValue('2030-10-15')
    expect(screen.getByLabelText(/Day, option 3/)).toHaveValue('2030-10-16')
  })

  it('says a video call gets its Teams link by itself', () => {
    renderModal(vi.fn(), true)

    expect(
      screen.getByText(
        'Leave empty and a Microsoft Teams meeting is created when they pick a time.',
      ),
    ).toBeInTheDocument()
  })
})

describe('ScheduleInterviewModal', () => {
  it('asks for the times by hand when Outlook is not connected', () => {
    renderModal()

    expect(
      screen.getByText('Outlook is not connected, so free times cannot be read — type them in.'),
    ).toBeInTheDocument()
    expect(browser.hiring.suggestSlots).not.toHaveBeenCalled()
  })

  it('says which zone the times are typed in and asks for what is missing', async () => {
    const user = userEvent.setup()
    renderModal()

    expect(screen.getByText('Times to offer, in Asia/Manila')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send times to pick from' }))

    expect(await screen.findByText('Pick at least one interviewer.')).toBeInTheDocument()
    expect(screen.getByText('Pick a date.')).toHaveAttribute('role', 'alert')
    expect(browser.hiring.offerInterview).not.toHaveBeenCalled()
  })

  it('needs an address for an in-person interview', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByText('In person'))
    await user.click(screen.getByRole('button', { name: 'Send times to pick from' }))

    expect(await screen.findByText('Say where the interview happens.')).toBeInTheDocument()
  })

  it('sends each time as the instant it names in the organization’s zone', async () => {
    browser.hiring.offerInterview.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    const { baseElement } = renderModal()

    await user.click(screen.getByLabelText(/Interviewers/, { selector: 'input' }))
    await user.click(await screen.findByRole('option', { name: 'Rita Santos' }))
    await user.type(screen.getByLabelText(/Day, option 1/), '2030-10-14')
    await user.type(screen.getByLabelText(/Time, option 1/), '10:00')
    await user.click(screen.getByRole('button', { name: 'Send times to pick from' }))

    await waitFor(() => expect(browser.hiring.offerInterview).toHaveBeenCalled())
    const sent = browser.hiring.offerInterview.mock.calls[0]?.[0]
    // Manila is UTC+8 all year, so 10:00 there is 02:00 UTC.
    expect(sent.slots).toEqual([
      { start: '2030-10-14T02:00:00.000Z', end: '2030-10-14T02:00:00.000Z' },
    ])
    expect(sent).toMatchObject({
      applicationId: 'app-1',
      interviewerIds: ['user-hr'],
      durationMinutes: 45,
    })
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
