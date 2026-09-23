'use client'

import { Alert, Button, Group, Skeleton, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { PageSection } from '@/components/page-section'
import { EmptyState } from '@/components/empty-state'
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_LABELS } from '../schema'
import { useCatalog } from '../use-contracts'
import { CatalogItemFormModal } from './catalog-item-form-modal'
import { CategoryTable } from './category-table'

/** The published rate card, grouped the way the card itself is written. */
export function RateCard({ canManage }: { canManage: boolean }) {
  const catalog = useCatalog()
  const [adding, addModal] = useDisclosure(false)

  const addButton = canManage ? (
    <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={addModal.open}>
      Add service
    </Button>
  ) : null
  const modal = canManage ? <CatalogItemFormModal opened={adding} onClose={addModal.close} /> : null

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
      <>
        <EmptyState
          title="No rate card yet"
          description={
            canManage
              ? 'Add your first service so contracts can be priced from the rate card.'
              : 'An organization admin adds services here; contracts are priced from them.'
          }
          action={addButton}
        />
        {modal}
      </>
    )
  }

  return (
    <Stack gap="lg">
      {addButton ? <Group justify="flex-end">{addButton}</Group> : null}
      {CATALOG_CATEGORIES.map((category) => {
        const items = catalog.data.filter((item) => item.category === category)
        if (items.length === 0) return null

        return (
          <PageSection key={category} title={CATALOG_CATEGORY_LABELS[category]}>
            <CategoryTable label={CATALOG_CATEGORY_LABELS[category]} items={items} />
          </PageSection>
        )
      })}
      {modal}
    </Stack>
  )
}
