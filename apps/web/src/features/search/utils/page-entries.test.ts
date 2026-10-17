import { describe, expect, it } from 'vitest'
import { visibleSections, type NavAccess } from '@/lib/navigation'
import { PAGE_TABS } from '@/lib/page-tabs'
import { routes } from '@/lib/routes'
import { pageEntries } from './page-entries'

const MEMBER: NavAccess = {
  canManageOrganization: false,
  canApproveRequests: false,
  canManageHiring: false,
  canViewWebsites: false,
}
const ADMIN: NavAccess = {
  canManageOrganization: true,
  canApproveRequests: true,
  canManageHiring: true,
  canViewWebsites: true,
}

function entriesFor(access: NavAccess) {
  return pageEntries(visibleSections(access), PAGE_TABS)
}

describe('pageEntries', () => {
  it('keeps a page inside an area under its own name, with the area beside it', () => {
    const calendar = entriesFor(ADMIN).find((entry) => entry.href === routes.attendanceCalendar)

    expect(calendar).toMatchObject({ label: 'Calendar', area: 'Time clock' })
    expect(calendar?.keywords).toContain('Time clock')
  })

  it('lists the tabs of a page the person can open', () => {
    const contracts = entriesFor(MEMBER).find((entry) => entry.label === 'Contracts')

    expect(contracts).toMatchObject({ area: 'Clients', href: `${routes.clients}?tab=contracts` })
  })

  it('never offers a page, or its tabs, that the sidebar hides', () => {
    const hrefs = entriesFor(MEMBER).map((entry) => entry.href)

    expect(hrefs).not.toContain(routes.organization)
    expect(hrefs).not.toContain(`${routes.organization}?tab=members`)
    expect(hrefs).not.toContain(`${routes.attendanceTeam}?tab=shifts`)
    expect(hrefs).not.toContain(routes.hiring)
  })

  it('offers the admin pages to an admin', () => {
    const hrefs = entriesFor(ADMIN).map((entry) => entry.href)

    expect(hrefs).toContain(`${routes.organization}?tab=members`)
    expect(hrefs).toContain(`${routes.attendanceTeam}?tab=shifts`)
  })

  it('includes settings, which the sidebar leaves out', () => {
    expect(entriesFor(MEMBER).map((entry) => entry.href)).toContain(routes.settings)
  })

  it('gives every entry a unique id', () => {
    const ids = entriesFor(ADMIN).map((entry) => entry.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
