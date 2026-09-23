'use client'

import { Alert, Button, Group, Skeleton, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { LookupOptionsModal } from '@/components/lookup-options-modal'
import { PageSection } from '@/components/page-section'
import { EmptyState } from '@/components/empty-state'
import { useLookupLists } from '@/features/lookups/hooks/use-lookup-admin'
import { groupBySection } from '../catalog-sections'
import { CATALOG_LOOKUP_KINDS } from '../schema'
import { useCatalog } from '../use-contracts'
import { CatalogItemFormModal } from './catalog-item-form-modal'
import { CategoryTable } from './category-table'

/** The published rate card, grouped under the sections an admin curates. */
export function RateCard({ canManage }: { canManage: boolean }) {
  const catalog = useCatalog()
  const lists = useLookupLists(CATALOG_LOOKUP_KINDS)
  const [adding, addModal] = useDisclosure(false)
  const [managing, manageModal] = useDisclosure(false)

  const sections = lists.data?.catalogSection ?? []

  const addButton = canManage ? (
    <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={addModal.open}>
      Add service
    </Button>
  ) : null
  const toolbar = canManage ? (
    <Group justify="flex-end">
      <Button variant="default" onClick={manageModal.open}>
        Manage sections
      </Button>
      {addButton}
    </Group>
  ) : null
  const modals = canManage ? (
    <>
      <CatalogItemFormModal
        opened={adding}
        onClose={addModal.close}
        sections={sections}
        onManageSections={manageModal.open}
      />
      <LookupOptionsModal
        opened={managing}
        onClose={manageModal.close}
        kinds={CATALOG_LOOKUP_KINDS}
        lists={lists.data ?? {}}
        initialKind="catalogSection"
      />
    </>
  ) : null

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
        {modals}
      </>
    )
  }

  return (
    <Stack gap="lg">
      {toolbar}
      {groupBySection(catalog.data, sections).map(({ section, items }) => (
        <PageSection key={section} title={section}>
          <CategoryTable label={section} items={items} />
        </PageSection>
      ))}
      {modals}
    </Stack>
  )
}
