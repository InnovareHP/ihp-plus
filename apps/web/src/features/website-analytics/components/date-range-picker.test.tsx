import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { DateRangePicker } from './date-range-picker'

const TODAY = '2026-11-26'
const LAST_30 = { start: '2026-10-27', end: '2026-11-25' }

function renderPicker() {
  const onApply = vi.fn()
  const view = render(
    <DateRangePicker preset="30d" range={LAST_30} today={TODAY} onApply={onApply} />,
  )
  return { onApply, ...view }
}

const trigger = () => screen.getByRole('button', { name: /Date range/ })

describe('DateRangePicker', () => {
  it('names the range it shows', () => {
    renderPicker()

    expect(trigger()).toHaveAccessibleName('Date range Last 30 days · Oct 27 – Nov 25, 2026')
  })

  it('applies a quick range', async () => {
    const user = userEvent.setup()
    const { onApply, container } = renderPicker()

    await user.click(trigger())
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Last month' }))
    expect(screen.getByText('Oct 1 – 31, 2026 · 31 days')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith('last-month', { start: '2026-10-01', end: '2026-10-31' })
  })

  it('walks through picking custom days on the calendar', async () => {
    const user = userEvent.setup()
    const { onApply } = renderPicker()

    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByText('Pick a start date')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '3 November 2026' }))
    expect(screen.getByText('Pick an end date')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '9 November 2026' }))
    expect(screen.getByText('Nov 3 – 9, 2026 · 7 days')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith('custom', { start: '2026-11-03', end: '2026-11-09' })
  })

  it('leaves the range alone on cancel, and stops at yesterday', async () => {
    const user = userEvent.setup()
    const { onApply } = renderPicker()

    await user.click(trigger())
    expect(screen.getByRole('button', { name: '26 November 2026' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onApply).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
    // Mantine hands focus back once the popover has finished closing.
    await waitFor(() => expect(trigger()).toHaveFocus())
  })
})
