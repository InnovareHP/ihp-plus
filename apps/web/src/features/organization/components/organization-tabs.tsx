'use client'

import { Tabs } from '@mantine/core'
import { IconBuilding, IconMailForward, IconUserCog, IconUsersGroup } from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { MembersTable } from '@/features/members/components/members-table'
import { ORGANIZATION_TABS, type OrganizationTab } from '@/lib/routes'
import { InvitationsPanel } from './invitations-panel'
import { OrganizationPanel } from './organization-panel'
import { TeamsPanel } from './teams-panel'

const TABS: { value: OrganizationTab; label: string; icon: ReactNode }[] = [
  { value: 'overview', label: 'Overview', icon: <IconBuilding size={16} aria-hidden /> },
  { value: 'members', label: 'Members', icon: <IconUserCog size={16} aria-hidden /> },
  { value: 'departments', label: 'Departments', icon: <IconUsersGroup size={16} aria-hidden /> },
  { value: 'invitations', label: 'Invitations', icon: <IconMailForward size={16} aria-hidden /> },
]

function tabOf(value: string | null): OrganizationTab {
  // Approvers moved into each department, so an old link to their tab lands where they are set.
  if (value === 'approvers') return 'departments'
  return (ORGANIZATION_TABS as readonly string[]).includes(value ?? '')
    ? (value as OrganizationTab)
    : 'overview'
}

export function OrganizationTabs({ invitedBy }: { invitedBy: string }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const tab = tabOf(searchParams.get('tab'))

  function openTab(next: string | null) {
    const value = tabOf(next)
    // Only the tab survives the switch: each panel keeps its own filters in the query string,
    // and carrying one panel's search into the next would filter a list nobody asked to filter.
    const href = value === 'overview' ? pathname : `${pathname}?tab=${value}`
    router.replace(href, { scroll: false })
  }

  return (
    <Tabs value={tab} onChange={openTab} keepMounted={false}>
      <Tabs.List mb="lg">
        {TABS.map((entry) => (
          <Tabs.Tab key={entry.value} value={entry.value} leftSection={entry.icon}>
            {entry.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {/* keepMounted={false}: an unopened tab must not run its queries. */}
      <Tabs.Panel value="overview">
        <OrganizationPanel />
      </Tabs.Panel>
      <Tabs.Panel value="members">
        <MembersTable />
      </Tabs.Panel>
      <Tabs.Panel value="departments">
        <TeamsPanel />
      </Tabs.Panel>
      <Tabs.Panel value="invitations">
        <InvitationsPanel invitedBy={invitedBy} />
      </Tabs.Panel>
    </Tabs>
  )
}
