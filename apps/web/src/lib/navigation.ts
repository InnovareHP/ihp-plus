import {
  IconAddressBook,
  IconBook2,
  IconBuilding,
  IconClipboardList,
  IconForms,
  IconGavel,
  IconLayoutDashboard,
  IconSettings,
  type Icon,
} from '@tabler/icons-react'
import { routes } from './routes'

export interface NavItem {
  href: string
  label: string
  description: string
  icon: Icon
  /** Only rendered for someone who can manage the organization. */
  manageOnly?: boolean
  /** Only rendered for a department approver, or an admin, who has a queue to read. */
  approverOnly?: boolean
}

export interface NavSection {
  id: string
  label: string
  items: readonly NavItem[]
  /** Only rendered for someone who can manage the organization. */
  manageOnly?: boolean
  /** Set when the section's first item is a landing page its siblings breadcrumb back to. */
  breadcrumbLabel?: string
}

export interface NavAccess {
  canManageOrganization: boolean
  canApproveRequests: boolean
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
      {
        href: routes.clients,
        label: 'Clients',
        description: 'Accounts and follow-ups',
        icon: IconAddressBook,
      },
      {
        href: routes.bluebook,
        label: 'Bluebook',
        description: 'Policies and forms',
        icon: IconBook2,
      },
    ],
  },
  {
    id: 'requests',
    label: 'Requests',
    breadcrumbLabel: 'Requests',
    items: [
      {
        href: routes.requests,
        label: 'My requests',
        description: 'Raise and track your own',
        icon: IconClipboardList,
      },
      {
        href: routes.requestApprovals,
        label: 'Approvals',
        description: 'Decide what came in',
        icon: IconGavel,
        approverOnly: true,
      },
      {
        href: routes.requestForms,
        label: 'Forms',
        description: 'Build what can be asked',
        icon: IconForms,
        manageOnly: true,
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
        label: 'Organization',
        description: 'People, departments and invites',
        icon: IconBuilding,
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

export function visibleSections(access: NavAccess) {
  return NAV_SECTIONS.filter((section) => !section.manageOnly || access.canManageOrganization)
    .map((section) => ({ ...section, items: section.items.filter((item) => canSee(item, access)) }))
    .filter((section) => section.items.length > 0)
}

function canSee(item: NavItem, access: NavAccess) {
  if (item.manageOnly && !access.canManageOrganization) return false
  if (item.approverOnly && !access.canApproveRequests) return false
  return true
}

// Sections list their routes flat, so a parent must not light up for its child's page.
export function isNavItemActive(pathname: string, href: string) {
  return pathname === href
}

export interface Crumb {
  label: string
  href?: string
}

// A section with a breadcrumbLabel has a landing page as its first item; every sibling
// breadcrumbs back to it, and sections without one stay flat.
export function breadcrumbsFor(pathname: string): Crumb[] {
  const section = NAV_SECTIONS.find((candidate) =>
    candidate.items.some((item) => item.href === pathname),
  )
  const item = section?.items.find((candidate) => candidate.href === pathname)
  if (!section?.breadcrumbLabel || !item) return []

  const landing = section.items[0]
  if (!landing || landing.href === item.href) return []

  return [{ label: section.breadcrumbLabel, href: landing.href }, { label: item.label }]
}
