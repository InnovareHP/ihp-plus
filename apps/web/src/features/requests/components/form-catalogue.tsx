'use client'

import { Alert, Button, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import { useAvailableForms } from '../hooks/use-requests'
import { FormCard } from './form-card'

export function FormCatalogue({ hasDepartment }: { hasDepartment: boolean }) {
  const forms = useAvailableForms()

  if (!hasDepartment) {
    return (
      <Alert color="yellow" variant="light" title="You have no department yet">
        <Text size="sm">
          Request forms are offered per department. Ask People &amp; Culture to place you in one.
        </Text>
      </Alert>
    )
  }

  if (forms.isPending) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" aria-busy="true">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={132} radius="md" />
        ))}
      </SimpleGrid>
    )
  }

  if (forms.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load the forms">
          <Text size="sm">{forms.error.message}</Text>
        </Alert>
        <Button onClick={() => forms.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  if (forms.data.length === 0) {
    return (
      <EmptyState
        title="No forms for your department yet"
        description="When an admin publishes one to your department it shows up here."
      />
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {forms.data.map((form) => (
        <FormCard key={form.id} form={form} />
      ))}
    </SimpleGrid>
  )
}
