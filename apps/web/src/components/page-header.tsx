import { Divider, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import type { Crumb } from '@/lib/navigation'
import { PageBreadcrumbs } from './page-breadcrumbs'

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  breadcrumbs?: readonly Crumb[]
  /** The one primary action for the page, plus at most one secondary beside it. */
  actions?: ReactNode
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <Stack gap="sm">
      {breadcrumbs && breadcrumbs.length > 0 ? <PageBreadcrumbs items={breadcrumbs} /> : null}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <Stack gap={4} miw={0}>
          <Title order={1} size="h2">
            {title}
          </Title>
          {description ? (
            <Text c="dimmed" maw="60ch">
              {description}
            </Text>
          ) : null}
        </Stack>
        {actions ? <Group gap="sm">{actions}</Group> : null}
      </Group>
      <Divider />
    </Stack>
  )
}
