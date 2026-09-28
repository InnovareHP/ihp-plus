import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { InterviewOffer } from '../schema'
import { InterviewPicker } from './interview-picker'

const actions = vi.hoisted(() => ({
  bookInterview: vi.fn(),
  askForOtherTimes: vi.fn(),
  submitApplication: vi.fn(),
  uploadApplicationFile: vi.fn(),
  withdrawApplication: vi.fn(),
}))
const nav = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('../public-actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh }) }))

const OFFER: InterviewOffer = {
  id: 'int-1',
  status: 'offered',
  format: 'video',
  location: '',
  note: 'Bring your licence.',
  durationMinutes: 45,
  slots: [
    { id: 'slot-1', start: '2026-10-14T02:00:00.000Z', end: '2026-10-14T02:45:00.000Z' },
    { id: 'slot-2', start: '2026-10-15T06:00:00.000Z', end: '2026-10-15T06:45:00.000Z' },
  ],
  bookedStart: undefined,
  bookedEnd: undefined,
  joinUrl: undefined,
}

function renderPicker(offer: InterviewOffer = OFFER) {
  return render(<InterviewPicker offer={offer} applicationId="app-1" signature="sig" />)
}

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone

beforeEach(() => vi.clearAllMocks())

describe('InterviewPicker', () => {
  it('lists each time in the reader’s own zone and names it', async () => {
    const { container } = renderPicker()

    expect(screen.getByLabelText('Your time zone', { selector: 'input' })).toHaveValue(browserZone)
    const expected = new Intl.DateTimeFormat('en-US', {
      timeZone: browserZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date('2026-10-14T02:00:00.000Z'))
    expect(screen.getByLabelText(`${expected} (${browserZone})`)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('asks for a choice before booking', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button', { name: 'Book this time' }))

    expect(await screen.findByText('Choose one of the times.')).toHaveAttribute('role', 'alert')
    expect(actions.bookInterview).not.toHaveBeenCalled()
  })

  it('books the chosen time with the zone it was read in', async () => {
    actions.bookInterview.mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getAllByRole('radio')[1] as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Book this time' }))

    await waitFor(() => expect(nav.refresh).toHaveBeenCalled())
    expect(actions.bookInterview).toHaveBeenCalledWith({
      applicationId: 'app-1',
      signature: 'sig',
      interviewId: 'int-1',
      slotId: 'slot-2',
      timeZone: browserZone,
    })
  })

  it('keeps the choice and says why when the time was just taken', async () => {
    actions.bookInterview.mockResolvedValue({
      ok: false,
      message: 'This interview is already booked or was withdrawn.',
    })
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getAllByRole('radio')[0] as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Book this time' }))

    expect(
      await screen.findByText('This interview is already booked or was withdrawn.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('radio')[0]).toBeChecked()
  })

  it('lets them say none of the times work', async () => {
    actions.askForOtherTimes.mockResolvedValue({ ok: true, data: undefined })
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button', { name: 'None of these work' }))

    await waitFor(() =>
      expect(actions.askForOtherTimes).toHaveBeenCalledWith({
        applicationId: 'app-1',
        signature: 'sig',
        interviewId: 'int-1',
      }),
    )
  })

  it('shows a booked interview with the way to back out', () => {
    renderPicker({ ...OFFER, status: 'booked', bookedStart: OFFER.slots[0]?.start })

    expect(screen.getByRole('heading', { name: 'Your interview' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'I can no longer make this time' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})
