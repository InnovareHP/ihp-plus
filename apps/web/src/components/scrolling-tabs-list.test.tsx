import { Tabs } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen } from '@/test/render'
import { ScrollingTabsList } from './scrolling-tabs-list'

describe('ScrollingTabsList', () => {
  it('is still a tab list with every tab reachable', async () => {
    const { container } = render(
      <Tabs value="onboarding">
        <ScrollingTabsList aria-label="Organization">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="onboarding">Onboarding</Tabs.Tab>
        </ScrollingTabsList>
      </Tabs>,
    )

    expect(screen.getByRole('tablist', { name: 'Organization' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Onboarding' })).toHaveAttribute('aria-selected', 'true')
    expect(await axe(container)).toHaveNoViolations()
  })
})
