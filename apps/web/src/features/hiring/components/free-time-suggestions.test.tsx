import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { FreeTimeSuggestions } from './free-time-suggestions'

const rpc = vi.hoisted(() => ({ suggestSlots: vi.fn() }))

vi.mock('../rpc', () => rpc)

function renderSuggestions(onPick = vi.fn(), interviewerIds = ['user-hr'], chosen: string[] = []) {
  const { container } = render(
    <FreeTimeSuggestions
      interviewerIds={interviewerIds}
      durationMinutes={45}
      timeZone="Asia/Manila"
      chosen={chosen}
      onPick={onPick}
    />,
  )
  return { onPick, container }
}

beforeEach(() => vi.clearAllMocks())

describe('FreeTimeSuggestions', () => {
  it('waits for interviewers before it reads anyone’s calendar', () => {
    renderSuggestions(vi.fn(), [])

    expect(screen.getByText(/Pick the interviewers/)).toBeInTheDocument()
    expect(rpc.suggestSlots).not.toHaveBeenCalled()
  })

  it('reads calendars by itself and adds a time as the wall clock in the organization’s zone', async () => {
    rpc.suggestSlots.mockResolvedValue({
      starts: ['2030-10-14T02:00:00.000Z', '2030-10-14T06:30:00.000Z'],
      fromCalendar: true,
    })
    const user = userEvent.setup()
    const { onPick, container } = renderSuggestions()

    await user.click(await screen.findByText('Mon, Oct 14, 2:30 PM'))

    expect(onPick).toHaveBeenCalledWith({ date: '2030-10-14', time: '14:30' })
    expect(rpc.suggestSlots.mock.calls[0]?.[0]).toMatchObject({
      interviewerIds: ['user-hr'],
      durationMinutes: 45,
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('marks a time already in the form as taken', async () => {
    rpc.suggestSlots.mockResolvedValue({
      starts: ['2030-10-14T02:00:00.000Z'],
      fromCalendar: true,
    })
    renderSuggestions(vi.fn(), ['user-hr'], ['2030-10-14 10:00'])

    expect(await screen.findByRole('checkbox', { name: 'Mon, Oct 14, 10:00 AM' })).toBeDisabled()
  })

  it('says when calendars are not connected, so HR types the times in', async () => {
    rpc.suggestSlots.mockResolvedValue({ starts: [], fromCalendar: false })
    renderSuggestions()

    expect(
      await screen.findByText('Outlook calendars are not connected, so type the times in below.'),
    ).toBeInTheDocument()
  })
})
