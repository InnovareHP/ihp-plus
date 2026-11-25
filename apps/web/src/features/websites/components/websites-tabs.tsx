'use client'

import { Tabs } from '@mantine/core'
import { IconChartLine, IconWorldCheck } from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { ScrollingTabsList } from '@/components/scrolling-tabs-list'
import { WEBSITE_TAB_LABELS } from '@/lib/page-tabs'
import { WEBSITE_TABS, type WebsiteTab } from '@/lib/routes'

function tabOf(value: string | null): WebsiteTab {
  return (WEBSITE_TABS as readonly string[]).includes(value ?? '')
    ? (value as WebsiteTab)
    : 'checks'
}

export interface WebsitesTabsProps {
  checks: ReactNode
  /** Null for anyone but an admin, who then sees the checks with no tabs at all. */
  analytics: ReactNode | null
}

export function WebsitesTabs({ checks, analytics }: WebsitesTabsProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  if (!analytics) return checks

  const tab = tabOf(searchParams.get('tab'))

  function openTab(next: string | null) {
    // Only the tab survives the switch, since the checks' day means nothing to the reports.
    const value = tabOf(next)
    router.replace(value === 'checks' ? pathname : `${pathname}?tab=${value}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onChange={openTab} keepMounted={false}>
      <ScrollingTabsList mb="lg">
        <Tabs.Tab value="checks" leftSection={<IconWorldCheck size={16} aria-hidden />}>
          {WEBSITE_TAB_LABELS.checks}
        </Tabs.Tab>
        <Tabs.Tab value="analytics" leftSection={<IconChartLine size={16} aria-hidden />}>
          {WEBSITE_TAB_LABELS.analytics}
        </Tabs.Tab>
      </ScrollingTabsList>

      {/* keepMounted={false}: an unopened tab must not run its queries. */}
      <Tabs.Panel value="checks">{checks}</Tabs.Panel>
      <Tabs.Panel value="analytics">{analytics}</Tabs.Panel>
    </Tabs>
  )
}
