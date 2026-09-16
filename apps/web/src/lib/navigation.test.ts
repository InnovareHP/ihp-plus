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

    expect(ids).toEqual(['workspace', 'requests', 'evaluations', 'account'])
  })

  it('offers an ordinary member only the evaluations they have to fill in', () => {
    expect(hrefsIn(NOBODY, 'evaluations')).toEqual([routes.evaluations])
    expect(hrefsIn(ADMIN, 'evaluations')).toEqual([
      routes.evaluations,
      routes.evaluationTracker,
      routes.evaluationForms,
    ])
  })

  it('shows a manager the organization page and folder access, nothing more', () => {
    // Overview, members, departments, invitations and approvers are tabs on one page, so they
    // are one link; folder access is a page of its own and earns the second.
    expect(hrefsIn(ADMIN, 'organization')).toEqual([routes.organization, routes.folderAccess])
  })

  it('offers an ordinary member their own requests and nothing else under them', () => {
    expect(hrefsIn(NOBODY, 'requests')).toEqual([routes.requests])
  })

  it('adds the approvals queue for a department approver, but not the admin screens', () => {
    expect(hrefsIn(APPROVER, 'requests')).toEqual([routes.requests, routes.requestApprovals])
  })

  it('gives an admin the forms screen too', () => {
    expect(hrefsIn(ADMIN, 'requests')).toEqual([
      routes.requests,
      routes.requestApprovals,
      routes.requestForms,
    ])
  })

  it('marks only the exact route active, so a section landing page does not light up too', () => {
    expect(isNavItemActive(routes.requestForms, routes.requestForms)).toBe(true)
    expect(isNavItemActive(routes.requestForms, routes.requests)).toBe(false)
    expect(isNavItemActive(routes.dashboard, routes.dashboard)).toBe(true)
  })

  it('breadcrumbs a nested page back to its section landing page', () => {
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
