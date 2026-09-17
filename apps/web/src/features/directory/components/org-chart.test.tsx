import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, within } from '@/test/render'
import { OrgChart } from './org-chart'

const CHART = {
  organizationName: 'Innovare Health Partners',
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

describe('OrgChart', () => {
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

  it('explains an organization with no departments yet', () => {
    render(<OrgChart chart={{ ...CHART, departments: [] }} />)

    expect(screen.getByText(/No departments are set up yet/)).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<OrgChart chart={CHART} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
