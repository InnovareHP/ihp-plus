'use client'

import { Alert, Badge, Button, Group, Skeleton, Stack, Table, Text } from '@mantine/core'
import { EmptyState, PageSection } from '@/components/page-shell'
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  formatPriceRange,
  type CatalogItemRow,
} from '../schema'
import { useCatalog } from '../use-contracts'

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

function CategoryTable({ label, items }: { label: string; items: readonly CatalogItemRow[] }) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table withTableBorder withColumnBorders striped verticalSpacing="xs" aria-label={label}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Service</Table.Th>
            <Table.Th scope="col">Description</Table.Th>
            <Table.Th scope="col" w={220}>
              Price
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Th scope="row" fw={500}>
                <Text size="sm" fw={500}>
                  {item.name}
                </Text>
              </Table.Th>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {item.description ?? '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="wrap">
                  <Text size="sm" fw={500}>
                    {/* A surcharge has no fee of its own, so a zero range would read as free. */}
                    {item.priceMaxCents === 0 ? 'Surcharge' : formatPriceRange(item)}
                  </Text>
                  {item.percentOfSpend ? (
                    <Badge variant="light" size="sm">
                      or {item.percentOfSpend}% of spend
                    </Badge>
                  ) : null}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
