import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent } from '@/test/render'
import { WebsitesTabs } from './websites-tabs'

const nav = vi.hoisted(() => ({ query: '', replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/websites',
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.query),
}))

beforeEach(() => {
  nav.query = ''
  nav.replace.mockReset()
})

describe('WebsitesTabs', () => {
  it('shows the checks alone to someone who cannot read analytics', () => {
    render(<WebsitesTabs checks={<p>Daily checklist</p>} analytics={null} />)

    expect(screen.getByText('Daily checklist')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('opens the tab named in the address', () => {
    nav.query = 'tab=analytics&site=magnolia'
    render(<WebsitesTabs checks={<p>Daily checklist</p>} analytics={<p>Traffic</p>} />)

    expect(screen.getByRole('tab', { name: 'Analytics' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Traffic')).toBeInTheDocument()
    expect(screen.queryByText('Daily checklist')).not.toBeInTheDocument()
  })

  it('switches tabs by keyboard without keeping the other tab’s filters', async () => {
    const user = userEvent.setup()
    nav.query = 'date=2026-11-20'
    const { container } = render(
      <WebsitesTabs checks={<p>Daily checklist</p>} analytics={<p>Traffic</p>} />,
    )

    await user.tab()
    expect(screen.getByRole('tab', { name: 'Daily checks' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')

    expect(nav.replace).toHaveBeenLastCalledWith('/websites?tab=analytics', { scroll: false })
    expect(await axe(container)).toHaveNoViolations()
  })
})
