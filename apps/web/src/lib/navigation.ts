import {
  IconAddressBook,
  IconClipboardCheck,
  IconUsers,
  IconBook2,
  IconBuilding,
  IconClipboardList,
  IconClockHour4,
  IconFolderOpen,
  IconFolders,
  IconLayoutDashboard,
  IconListCheck,
  IconSpeakerphone,
  type Icon,
} from '@tabler/icons-react'
import { routes } from './routes'

/** A page in the sidebar. Inside a group it is a child; on its own it is a row. */
export interface NavLink {
  href: string
  label: string
  description: string
  /** Only rendered for someone who can manage the organization. */
  manageOnly?: boolean
  /** Only rendered for a department approver, or an admin, who has a queue to read. */
  approverOnly?: boolean
  /** A live count beside the label; the shell decides what renders it. */
  badge?: 'bulletinUnread'
}

export interface NavItem extends NavLink {
  icon: Icon
  /**
   * Pages that belong to this area. A group is one collapsed row until the user is inside it,
   * which is what keeps the sidebar short as the app grows.
   */
  children?: readonly NavLink[]
}

export interface NavSection {
  id: string
  label: string
  items: readonly NavItem[]
  /** Only rendered for someone who can manage the organization. */
  manageOnly?: boolean
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
        href: routes.bulletin,
        label: 'Bulletin board',
        description: 'Company news, reactions and replies',
        icon: IconSpeakerphone,
        badge: 'bulletinUnread',
      },
      {
        href: routes.directory,
        label: 'Directory',
        description: 'Who works here',
        icon: IconUsers,
      },
      {
        href: routes.clients,
        label: 'Clients',
        description: 'Accounts and follow-ups',
        icon: IconAddressBook,
      },
      {
        href: routes.tasks,
        label: 'Tasks',
        description: 'Projects and what is left to do',
        icon: IconListCheck,
      },
      {
        href: routes.attendance,
        label: 'Time clock',
        description: 'Clock in, take a break, see your hours',
        icon: IconClockHour4,
        children: [
          {
            href: routes.attendance,
            label: 'My time clock',
            description: 'Clock in, take a break, see your hours',
          },
          {
            href: routes.attendanceCalendar,
            label: 'Calendar',
            description: 'Holidays, leave and your days by month',
          },
          {
            href: routes.attendanceTeam,
            label: 'Team attendance',
            description: 'Who is in, timesheets and shifts',
            manageOnly: true,
          },
        ],
      },
      {
        href: routes.bluebook,
        label: 'Bluebook',
        description: 'Policies and forms',
        icon: IconBook2,
      },
      {
        href: routes.library,
        label: 'Internal library',
        description: 'Every document the company keeps in SharePoint',
        icon: IconFolderOpen,
      },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      {
        href: routes.requests,
        label: 'Requests',
        description: 'Raise one, decide the ones that came in',
        icon: IconClipboardList,
        children: [
          {
            href: routes.requests,
            label: 'My requests',
            description: 'Raise and track your own',
          },
          {
            href: routes.requestApprovals,
            label: 'Approvals',
            description: 'Decide what came in',
            approverOnly: true,
          },
          {
            href: routes.requestForms,
            label: 'Forms',
            description: 'Build what can be asked',
            manageOnly: true,
          },
        ],
      },
      {
        href: routes.evaluations,
        label: 'Evaluations',
        description: 'Reviews you owe and reviews you track',
        icon: IconClipboardCheck,
        children: [
          {
            href: routes.evaluations,
            label: 'My evaluations',
            description: 'People you have to evaluate',
          },
          {
            href: routes.evaluationTracker,
            label: 'Assigned',
            description: 'Who has and has not answered',
            manageOnly: true,
          },
          {
            href: routes.evaluationForms,
            label: 'Forms',
            description: 'Build what is asked about someone',
            manageOnly: true,
          },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    manageOnly: true,
    items: [
      {
        href: routes.organization,
        label: 'Organization',
        description: 'People, departments and invites',
        icon: IconBuilding,
      },
      {
        href: routes.folderAccess,
        label: 'Folder access',
        description: 'Who outside the company can open a client folder',
        icon: IconFolders,
      },
    ],
  },
]

// Settings is deliberately absent: the account menu and the profile button at the foot of the
// sidebar both reach it, and a third entry only lengthened the list.

export function visibleSections(access: NavAccess): NavSection[] {
  return NAV_SECTIONS.filter((section) => !section.manageOnly || access.canManageOrganization)
    .map((section) => ({ ...section, items: itemsFor(section, access) }))
    .filter((section) => section.items.length > 0)
}

function itemsFor(section: NavSection, access: NavAccess): NavItem[] {
  return section.items.flatMap((item) => {
    if (!canSee(item, access)) return []
    if (!item.children) return [item]

    const children = item.children.filter((child) => canSee(child, access))
    if (children.length === 0) return []

    // One reachable page is not an area: an ordinary member gets "Requests" as a plain row
    // rather than a disclosure that opens onto a single link.
    if (children.length === 1) {
      const only = children[0] as NavLink
      return [{ ...item, href: only.href, description: only.description, children: undefined }]
    }

    return [{ ...item, children }]
  })
}

function canSee(item: NavLink, access: NavAccess) {
  if (item.manageOnly && !access.canManageOrganization) return false
  if (item.approverOnly && !access.canApproveRequests) return false
  return true
}

// Sections list their routes flat, so a parent must not light up for its child's page.
export function isNavItemActive(pathname: string, href: string) {
  return pathname === href
}

/** A group opens itself for the page the user is on; closing it again is their business. */
export function isGroupOpen(pathname: string, item: NavItem) {
  return Boolean(item.children?.some((child) => child.href === pathname))
}

export interface Crumb {
  label: string
  href?: string
}

// A group's first child is its landing page; every sibling breadcrumbs back to it, and pages
// outside a group stay flat.
export function breadcrumbsFor(pathname: string): Crumb[] {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const child = item.children?.find((candidate) => candidate.href === pathname)
      const landing = item.children?.[0]
      if (!child || !landing || landing.href === child.href) continue

      return [{ label: item.label, href: landing.href }, { label: child.label }]
    }
  }

  return []
}
