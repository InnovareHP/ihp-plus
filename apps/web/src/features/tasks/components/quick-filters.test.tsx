import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { QuickFilters } from './quick-filters'

describe('QuickFilters', () => {
  it('turns a filter on and off in one tap each', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <QuickFilters assignee="all" due="any" showMine onChange={onChange} />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Mine' }))
    expect(onChange).toHaveBeenLastCalledWith({ assignee: 'mine' })

    rerender(<QuickFilters assignee="all" due="overdue" showMine onChange={onChange} />)
    expect(screen.getByRole('checkbox', { name: 'Overdue' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Overdue' }))
    expect(onChange).toHaveBeenLastCalledWith({ due: 'any' })
  })

  it('switches between the two due filters rather than stacking them', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<QuickFilters assignee="all" due="overdue" showMine onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Due this week' }))
    expect(onChange).toHaveBeenLastCalledWith({ due: 'week' })
  })

  it('leaves out "Mine" on a board of only your own tasks', () => {
    render(<QuickFilters assignee="all" due="any" showMine={false} onChange={vi.fn()} />)
    expect(screen.queryByRole('checkbox', { name: 'Mine' })).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <QuickFilters assignee="mine" due="week" showMine onChange={vi.fn()} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
