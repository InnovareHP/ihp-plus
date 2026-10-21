import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import { OrgChart } from './org-chart'

const CHART = {
  organizationName: 'IHP+',
  unassignedCount: 1,
  departments: [
    {
      teamId: 'team-1',
      name: 'Revenue Cycle',
      leads: [{ userId: 'user-1', name: 'Ada Lovelace', jobTitle: 'Revenue Cycle Director' }],
      members: [{ userId: 'user-2', name: 'Grace Hopper', jobTitle: 'Billing Specialist' }],
    },
    { teamId: 'team-2', name: 'Compliance', leads: [], members: [] },
  ],
}

// jsdom does no layout, so the Spoiler is told its content is taller than its cap.
class TallObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    const size = [{ inlineSize: 300, blockSize: 600 }]
    this.callback(
      [{ target, borderBoxSize: size, contentBoxSize: size, contentRect: new DOMRect() }] as never,
      this as never,
    )
  }
  unobserve() {}
  disconnect() {}
}

const QuietObserver = globalThis.ResizeObserver

describe('OrgChart', () => {
  afterEach(() => {
    vi.stubGlobal('ResizeObserver', QuietObserver)
  })

  it('shows each department as its own section, leads above the team', () => {
    render(<OrgChart chart={CHART} />)

    const revenue = screen.getByRole('region', { name: 'Revenue Cycle' })
    expect(within(revenue).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(revenue).getByText('Grace Hopper')).toBeInTheDocument()
    expect(within(revenue).getByText('2 people')).toBeInTheDocument()
    expect(screen.getByText(/1 person has no department yet/)).toBeInTheDocument()
  })

  it('says when a department has no lead and no one in it, rather than leaving it blank', () => {
    render(<OrgChart chart={CHART} />)

    const compliance = screen.getByRole('region', { name: 'Compliance' })
    expect(within(compliance).getByText('No lead appointed.')).toBeInTheDocument()
    expect(
      within(compliance).getByText('No one else is in this department yet.'),
    ).toBeInTheDocument()
  })

  it('collapses a long team behind a show all control', async () => {
    vi.stubGlobal('ResizeObserver', TallObserver)
    const person = userEvent.setup()
    render(<OrgChart chart={CHART} />)

    const toggle = await screen.findByRole('button', { name: 'Show all of Revenue Cycle' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('Show all')

    await person.click(toggle)
    const collapse = screen.getByRole('button', { name: 'Show less of Revenue Cycle' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')
  })

  it('explains an organization with no departments yet', () => {
    render(<OrgChart chart={{ ...CHART, departments: [] }} />)

    expect(screen.getByText('No departments are set up yet')).toBeInTheDocument()
    expect(screen.getByText(/An admin adds them on the organization page/)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<OrgChart chart={CHART} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
