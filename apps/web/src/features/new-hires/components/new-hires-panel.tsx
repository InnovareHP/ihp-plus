'use client'

import { Alert, Button, Card, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core'
import { useChecklistSetup } from '../hooks/use-checklist-setup'
import { FirstDayTasksSetup } from './first-day-tasks-setup'
import { NewHiresTable } from './new-hires-table'
import { RequiredReadingSetup } from './required-reading-setup'

/** The admin half of the new-hire checklist: who is stuck where, and what the checklist asks. */
export function NewHiresPanel() {
  const setup = useChecklistSetup()

  return (
    <Stack gap="xl">
      <NewHiresTable />

      <Stack gap="md" component="section" aria-labelledby="checklist-setup-heading">
        <Stack gap={2}>
          <Title order={2} size="h4" id="checklist-setup-heading">
            What the checklist asks
          </Title>
          <Text size="sm" c="dimmed">
            Every new hire also finishes their profile and gets a shift from you on the Members tab.
            The reading and tasks below are yours to choose.
          </Text>
        </Stack>

        {setup.isPending ? (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" aria-busy="true">
            <Skeleton height={320} radius="md" />
            <Skeleton height={320} radius="md" />
          </SimpleGrid>
        ) : setup.isError ? (
          <Stack gap="sm">
            <Alert role="alert" color="red" variant="light" title="Could not load the checklist">
              <Text size="sm">{setup.error.message}</Text>
            </Alert>
            <Button onClick={() => void setup.refetch()} w="fit-content">
              Try again
            </Button>
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card padding="lg" component="section" aria-labelledby="required-reading-heading">
              <Stack gap="md">
                <Title order={3} size="h5" id="required-reading-heading">
                  Required reading
                </Title>
                <RequiredReadingSetup setup={setup.data} />
              </Stack>
            </Card>
            <Card padding="lg" component="section" aria-labelledby="first-day-tasks-heading">
              <Stack gap="md">
                <Title order={3} size="h5" id="first-day-tasks-heading">
                  First-day tasks
                </Title>
                <FirstDayTasksSetup tasks={setup.data.tasks} />
              </Stack>
            </Card>
          </SimpleGrid>
        )}
      </Stack>
    </Stack>
  )
}
