import {
  ATTENDANCE_TABS,
  CLIENT_TABS,
  ORGANIZATION_TABS,
  clientTab,
  organizationTab,
  routes,
  type AttendanceTab,
  type ClientTab,
  type OrganizationTab,
} from './routes'

// A Record, not a list, so a tab id added to routes.ts fails typecheck until it is named here.
export const CLIENT_TAB_LABELS: Record<ClientTab, string> = {
  clients: 'Clients',
  contracts: 'Contracts',
  rates: 'Rate card',
}

export const ORGANIZATION_TAB_LABELS: Record<OrganizationTab, string> = {
  overview: 'Overview',
  members: 'Members',
  departments: 'Departments',
  invitations: 'Invitations',
  onboarding: 'Onboarding',
}

export const ATTENDANCE_TAB_LABELS: Record<AttendanceTab, string> = {
  today: 'Today',
  timesheets: 'Timesheets',
  calendar: 'Calendar',
  shifts: 'Shifts',
}

export interface PageTab {
  /** The sidebar page the tab sits on; a tab is only as visible as its page. */
  page: string
  label: string
  href: string
}

function attendanceTab(tab: AttendanceTab) {
  return tab === 'today' ? routes.attendanceTeam : `${routes.attendanceTeam}?tab=${tab}`
}

// The first tab of each page is the page itself, so only the others are listed.
export const PAGE_TABS: readonly PageTab[] = [
  ...CLIENT_TABS.slice(1).map((tab) => ({
    page: routes.clients,
    label: CLIENT_TAB_LABELS[tab],
    href: clientTab(tab),
  })),
  ...ORGANIZATION_TABS.slice(1).map((tab) => ({
    page: routes.organization,
    label: ORGANIZATION_TAB_LABELS[tab],
    href: organizationTab(tab),
  })),
  ...ATTENDANCE_TABS.slice(1).map((tab) => ({
    page: routes.attendanceTeam,
    label: ATTENDANCE_TAB_LABELS[tab],
    href: attendanceTab(tab),
  })),
]
