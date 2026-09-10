import { describe, expect, it } from 'vitest'
import { breadcrumbsFor, isNavItemActive, visibleSections } from './navigation'
import { routes } from './routes'

describe('navigation', () => {
  it('hides the organization section from someone who cannot manage it', () => {
    const ids = visibleSections(false).map((section) => section.id)

    expect(ids).toEqual(['workspace', 'account'])
  })

  it('shows the organization section to a manager', () => {
    const organization = visibleSections(true).find((section) => section.id === 'organization')

    expect(organization?.items.map((item) => item.href)).toEqual([
      routes.organization,
      routes.members,
      routes.teams,
      routes.invitations,
    ])
  })

  it('marks only the exact route active, so a section landing page does not light up too', () => {
    expect(isNavItemActive(routes.teams, routes.teams)).toBe(true)
    expect(isNavItemActive(routes.teams, routes.organization)).toBe(false)
    expect(isNavItemActive(routes.dashboard, routes.dashboard)).toBe(true)
  })

  it('breadcrumbs a nested organization page back to its landing page', () => {
    expect(breadcrumbsFor(routes.members)).toEqual([
      { label: 'Organization', href: routes.organization },
      { label: 'Members' },
    ])
  })

  it('leaves top-level pages without breadcrumbs', () => {
    expect(breadcrumbsFor(routes.dashboard)).toEqual([])
    expect(breadcrumbsFor(routes.organization)).toEqual([])
    expect(breadcrumbsFor('/nowhere')).toEqual([])
  })
})
