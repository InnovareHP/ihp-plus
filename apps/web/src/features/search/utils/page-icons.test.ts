import { IconAddressBook, IconClockHour4, IconSettings } from '@tabler/icons-react'
import { describe, expect, it } from 'vitest'
import { visibleSections } from '@/lib/navigation'
import { routes } from '@/lib/routes'
import { iconFor, pageIcons } from './page-icons'

const ICONS = pageIcons(
  visibleSections({
    canManageOrganization: true,
    canApproveRequests: true,
    canManageHiring: true,
    canViewWebsites: true,
  }),
)

describe('page icons', () => {
  it('gives a page inside an area the area’s sidebar icon', () => {
    expect(iconFor(ICONS, routes.attendanceCalendar)).toBe(IconClockHour4)
  })

  it('finds a tab’s icon from the page it sits on', () => {
    expect(iconFor(ICONS, `${routes.clients}?tab=contracts`)).toBe(IconAddressBook)
  })

  it('gives settings, which the sidebar leaves out, the gear', () => {
    expect(iconFor(ICONS, routes.settings)).toBe(IconSettings)
  })

  it('has no icon for a path nothing registered', () => {
    expect(iconFor(ICONS, '/nowhere')).toBeUndefined()
  })
})
