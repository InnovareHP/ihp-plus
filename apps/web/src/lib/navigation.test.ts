import { describe, expect, it } from 'vitest'
import { breadcrumbsFor, isGroupOpen, isNavItemActive, visibleSections } from './navigation'
import { routes } from './routes'

const NOBODY = { canManageOrganization: false, canApproveRequests: false }
const APPROVER = { canManageOrganization: false, canApproveRequests: true }
const ADMIN = { canManageOrganization: true, canApproveRequests: true }

function itemIn(access: typeof NOBODY, sectionId: string, label: string) {
  return visibleSections(access)
    .find((section) => section.id === sectionId)
    ?.items.find((item) => item.label === label)
}

function hrefsIn(access: typeof NOBODY, sectionId: string) {
  return (
    visibleSections(access)
      .find((section) => section.id === sectionId)
      ?.items.map((item) => item.href) ?? []
  )
}

describe('navigation', () => {
  it('offers the calendar to everyone under the time clock', () => {
    expect(
      itemIn(NOBODY, 'workspace', 'Time clock')?.children?.map((child) => child.href),
    ).toContain(routes.attendanceCalendar)
  })

  it('hides the admin section from someone who cannot manage the organization', () => {
    expect(visibleSections(NOBODY).map((section) => section.id)).toEqual(['workspace', 'work'])
    expect(visibleSections(ADMIN).map((section) => section.id)).toEqual([
      'workspace',
      'work',
      'admin',
    ])
  })

  it('keeps the everyday pages one click away', () => {
    expect(hrefsIn(NOBODY, 'workspace')).toEqual([
      routes.dashboard,
      routes.bulletin,
      routes.directory,
      routes.clients,
      routes.tasks,
      routes.attendance,
      routes.bluebook,
      routes.library,
    ])
  })

  it('collapses a group down to a plain row when only one page inside it is reachable', () => {
    const requests = itemIn(NOBODY, 'work', 'Requests')

    expect(requests?.children).toBeUndefined()
    expect(requests?.href).toBe(routes.requests)
  })

  it('groups the pages an approver can reach under one row', () => {
    expect(itemIn(APPROVER, 'work', 'Requests')?.children?.map((child) => child.href)).toEqual([
      routes.requests,
      routes.requestApprovals,
    ])
  })

  it('gives an admin every page of both areas', () => {
    expect(itemIn(ADMIN, 'work', 'Requests')?.children?.map((child) => child.href)).toEqual([
      routes.requests,
      routes.requestApprovals,
      routes.requestForms,
    ])
    expect(itemIn(ADMIN, 'work', 'Evaluations')?.children?.map((child) => child.href)).toEqual([
      routes.evaluations,
      routes.evaluationTracker,
      routes.evaluationForms,
    ])
  })

  it('shows a manager the organization page and folder access, nothing more', () => {
    // Overview, members, departments, invitations and approvers are tabs on one page, so they
    // are one link; folder access is a page of its own and earns the second.
    expect(hrefsIn(ADMIN, 'admin')).toEqual([routes.organization, routes.folderAccess])
  })

  it('leaves settings out of the sidebar, where the account menu already reaches it', () => {
    const hrefs = visibleSections(ADMIN).flatMap((section) =>
      section.items.flatMap((item) => [item.href, ...(item.children ?? []).map((c) => c.href)]),
    )

    expect(hrefs).not.toContain(routes.settings)
  })

  it('opens the group holding the page the user is on, and only that one', () => {
    const requests = itemIn(ADMIN, 'work', 'Requests')
    const evaluations = itemIn(ADMIN, 'work', 'Evaluations')

    expect(requests && isGroupOpen(routes.requestForms, requests)).toBe(true)
    expect(evaluations && isGroupOpen(routes.requestForms, evaluations)).toBe(false)
  })

  it('marks only the exact route active, so a group landing page does not light up too', () => {
    expect(isNavItemActive(routes.requestForms, routes.requestForms)).toBe(true)
    expect(isNavItemActive(routes.requestForms, routes.requests)).toBe(false)
    expect(isNavItemActive(routes.dashboard, routes.dashboard)).toBe(true)
  })

  it('breadcrumbs a page inside a group back to that group landing page', () => {
    expect(breadcrumbsFor(routes.requestForms)).toEqual([
      { label: 'Requests', href: routes.requests },
      { label: 'Forms' },
    ])
    expect(breadcrumbsFor(routes.evaluationTracker)).toEqual([
      { label: 'Evaluations', href: routes.evaluations },
      { label: 'Assigned' },
    ])
  })

  it('leaves landing pages and ungrouped pages without breadcrumbs', () => {
    expect(breadcrumbsFor(routes.dashboard)).toEqual([])
    expect(breadcrumbsFor(routes.clients)).toEqual([])
    expect(breadcrumbsFor(routes.organization)).toEqual([])
    expect(breadcrumbsFor(routes.requests)).toEqual([])
    expect(breadcrumbsFor('/nowhere')).toEqual([])
  })
})
