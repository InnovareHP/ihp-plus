import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { ApplicationSummary } from '../schema'
import { ScheduleInterviewModal } from './schedule-interview-modal'

const browser = vi.hoisted(() => ({
  hiring: {
    listInterviewers: vi.fn(),
    offerInterview: vi.fn(),
  },
}))

// Mocked at the transport, so the real rpc module turns HR's wall clock into instants.
vi.mock('@/rpc/browser', () => ({ browserClients: browser }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

const APPLICATION = { id: 'app-1', fullName: 'Grace Hopper' } as ApplicationSummary

function renderModal(onClose = vi.fn()) {
  return render(
    <ScheduleInterviewModal application={APPLICATION} timeZone="Asia/Manila" onClose={onClose} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  browser.hiring.listInterviewers.mockResolvedValue({
    people: [{ userId: 'user-hr', name: 'Rita Santos', email: 'rita@ihp.test' }],
  })
})

describe('ScheduleInterviewModal', () => {
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
