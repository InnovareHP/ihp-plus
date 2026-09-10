import { Card, Container, Divider, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import type { Crumb } from '@/lib/navigation'
import { PageBreadcrumbs } from './page-breadcrumbs'

// Every page's padding and vertical rhythm is owned here, so AppShell.Main carries none.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <Container size="xl" px={{ base: 'md', sm: 'lg' }} py={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="xl">{children}</Stack>
    </Container>
  )
}

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

export interface PageSectionProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function PageSection({ title, description, actions, children }: PageSectionProps) {
  return (
    <Card component="section" padding="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm" mb="md">
        <Stack gap={2} miw={0}>
          <Title order={2} size="h5">
            {title}
          </Title>
          {description ? (
            <Text size="sm" c="dimmed" maw="70ch">
              {description}
            </Text>
          ) : null}
        </Stack>
        {actions ? <Group gap="xs">{actions}</Group> : null}
      </Group>
      {children}
    </Card>
  )
}

export interface EmptyStateProps {
  title: string
  description: ReactNode
  action?: ReactNode
}

// Empty states name the benefit and carry the control that fills them.
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" gap="xs" py="xl" px="md">
      <Text fw={600}>{title}</Text>
      <Text size="sm" c="dimmed" ta="center" maw="46ch">
        {description}
      </Text>
      {action ? <Group mt="xs">{action}</Group> : null}
    </Stack>
  )
}
