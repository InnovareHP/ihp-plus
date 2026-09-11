'use client'

import { Tabs } from '@mantine/core'
import { IconAddressBook, IconFileText, IconTag } from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { ContractsTable } from '@/features/contracts/components/contracts-table'
import { RateCard } from '@/features/contracts/components/rate-card'
import { CLIENT_TABS, type ClientTab } from '@/lib/routes'
import { ClientsTable } from './clients-table'

const TABS: { value: ClientTab; label: string; icon: ReactNode }[] = [
  { value: 'clients', label: 'Clients', icon: <IconAddressBook size={16} aria-hidden /> },
  { value: 'contracts', label: 'Contracts', icon: <IconFileText size={16} aria-hidden /> },
  { value: 'rates', label: 'Rate card', icon: <IconTag size={16} aria-hidden /> },
]

function tabOf(value: string | null): ClientTab {
  return (CLIENT_TABS as readonly string[]).includes(value ?? '') ? (value as ClientTab) : 'clients'
}

export function ClientTabs({ canManage }: { canManage: boolean }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const tab = tabOf(searchParams.get('tab'))

  function openTab(next: string | null) {
    const value = tabOf(next)
    // Only the tab survives the switch: each panel keeps its own filters in the query string,
    // and carrying one panel's search into the next would filter a list nobody asked to filter.
    const href = value === 'clients' ? pathname : `${pathname}?tab=${value}`
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
      <Tabs.Panel value="clients">
        <ClientsTable />
      </Tabs.Panel>
      <Tabs.Panel value="contracts">
        <ContractsTable canManage={canManage} />
      </Tabs.Panel>
      <Tabs.Panel value="rates">
        <RateCard />
      </Tabs.Panel>
    </Tabs>
  )
}
