import {
  IconBuilding,
  IconLayoutDashboard,
  IconMailForward,
  IconSettings,
  IconUserCog,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react'
import { routes } from './routes'

export interface NavItem {
  href: string
  label: string
  description: string
  icon: Icon
}

export interface NavSection {
  id: string
  label: string
  items: readonly NavItem[]
  /** Only rendered for someone who can manage the organization. */
  manageOnly?: boolean
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        href: routes.dashboard,
        label: 'Dashboard',
        description: 'Your day at a glance',
        icon: IconLayoutDashboard,
      },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    manageOnly: true,
    items: [
      {
        href: routes.organization,
        label: 'Overview',
        description: 'Company profile',
        icon: IconBuilding,
      },
      {
        href: routes.members,
        label: 'Members',
        description: 'Roles and access',
        icon: IconUserCog,
      },
      {
        href: routes.teams,
        label: 'Departments',
        description: 'Teams and assignment',
        icon: IconUsersGroup,
      },
      {
        href: routes.invitations,
        label: 'Invitations',
        description: 'Pending invites',
        icon: IconMailForward,
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        href: routes.settings,
        label: 'Settings',
        description: 'Profile and account',
        icon: IconSettings,
      },
    ],
  },
]

export function visibleSections(canManageOrganization: boolean) {
  return NAV_SECTIONS.filter((section) => !section.manageOnly || canManageOrganization)
}

// Sections list their routes flat, so a parent must not light up for its child's page.
export function isNavItemActive(pathname: string, href: string) {
  return pathname === href
}

export interface Crumb {
  label: string
  href?: string
}

// Every org page sits one level under the section landing page, which is the only depth
// breadcrumbs are needed at today.
export function breadcrumbsFor(pathname: string): Crumb[] {
  const section = NAV_SECTIONS.find((candidate) =>
    candidate.items.some((item) => item.href === pathname),
  )
  const item = section?.items.find((candidate) => candidate.href === pathname)
  if (!section || !item || section.id !== 'organization') return []

  const landing = section.items[0]
  if (!landing || landing.href === item.href) return []

  return [{ label: 'Organization', href: landing.href }, { label: item.label }]
}
