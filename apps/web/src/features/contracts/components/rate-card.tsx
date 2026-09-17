'use client'

import { Alert, Button, Skeleton, Stack, Text } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import { EmptyState } from '@/components/empty-state'
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_LABELS } from '../schema'
import { useCatalog } from '../use-contracts'
import { CategoryTable } from './category-table'

/** The published rate card, grouped the way the card itself is written. */
export function RateCard() {
  const catalog = useCatalog()

  if (catalog.isPending) {
    return (
      <Stack gap="md" aria-busy="true">
        {[0, 1, 2].map((block) => (
          <Skeleton key={block} height={140} radius="md" />
        ))}
      </Stack>
    )
  }

  if (catalog.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load the rate card">
          <Text size="sm">{catalog.error.message}</Text>
        </Alert>
        <Button onClick={() => catalog.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  if (catalog.data.length === 0) {
    return (
      <EmptyState
        title="No rate card yet"
        description="Seed the catalog or add a service to start pricing contracts."
      />
    )
  }

  return (
    <Stack gap="lg">
      {CATALOG_CATEGORIES.map((category) => {
        const items = catalog.data.filter((item) => item.category === category)
        if (items.length === 0) return null

        return (
          <PageSection key={category} title={CATALOG_CATEGORY_LABELS[category]}>
            <CategoryTable label={CATALOG_CATEGORY_LABELS[category]} items={items} />
          </PageSection>
        )
      })}
    </Stack>
  )
}
