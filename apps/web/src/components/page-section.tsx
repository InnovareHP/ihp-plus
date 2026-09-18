import { Card, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface PageSectionProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  /** Caps the card itself: a one-column form reads as a column, not as a wide box. */
  maw?: number
  children: ReactNode
}

export function PageSection({ title, description, actions, maw, children }: PageSectionProps) {
  return (
    <Card component="section" padding="lg" maw={maw} w="100%">
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
