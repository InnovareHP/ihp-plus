import { describe, expect, it } from 'vitest'
import { breadcrumbsFor, isNavItemActive, visibleSections } from './navigation'
import { routes } from './routes'

const NOBODY = { canManageOrganization: false, canApproveRequests: false }
const APPROVER = { canManageOrganization: false, canApproveRequests: true }
const ADMIN = { canManageOrganization: true, canApproveRequests: true }

function hrefsIn(access: typeof NOBODY, sectionId: string) {
  return (
    visibleSections(access)
      .find((section) => section.id === sectionId)
      ?.items.map((item) => item.href) ?? []
  )
}

describe('navigation', () => {
  it('hides the organization section from someone who cannot manage it', () => {
    const ids = visibleSections(NOBODY).map((section) => section.id)

    expect(ids).toEqual(['workspace', 'requests', 'account'])
  })

  it('shows the organization section to a manager', () => {
    expect(hrefsIn(ADMIN, 'organization')).toEqual([
      routes.organization,
      routes.members,
      routes.teams,
      routes.invitations,
    ])
  })

  it('offers an ordinary member their own requests and nothing else under them', () => {
    expect(hrefsIn(NOBODY, 'requests')).toEqual([routes.requests])
  })

  it('adds the approvals queue for a department approver, but not the admin screens', () => {
    expect(hrefsIn(APPROVER, 'requests')).toEqual([routes.requests, routes.requestApprovals])
  })

  it('gives an admin the forms and approvers screens too', () => {
    expect(hrefsIn(ADMIN, 'requests')).toEqual([
      routes.requests,
      routes.requestApprovals,
      routes.requestForms,
      routes.requestApprovers,
    ])
  })

  it('marks only the exact route active, so a section landing page does not light up too', () => {
    expect(isNavItemActive(routes.teams, routes.teams)).toBe(true)
    expect(isNavItemActive(routes.teams, routes.organization)).toBe(false)
    expect(isNavItemActive(routes.dashboard, routes.dashboard)).toBe(true)
  })

  it('breadcrumbs a nested page back to its section landing page', () => {
    expect(breadcrumbsFor(routes.members)).toEqual([
      { label: 'Organization', href: routes.organization },
      { label: 'Members' },
    ])
    expect(breadcrumbsFor(routes.requestForms)).toEqual([
      { label: 'Requests', href: routes.requests },
      { label: 'Forms' },
    ])
  })

  it('leaves landing pages and flat sections without breadcrumbs', () => {
    expect(breadcrumbsFor(routes.dashboard)).toEqual([])
    expect(breadcrumbsFor(routes.clients)).toEqual([])
    expect(breadcrumbsFor(routes.organization)).toEqual([])
    expect(breadcrumbsFor(routes.requests)).toEqual([])
    expect(breadcrumbsFor('/nowhere')).toEqual([])
  })
})
