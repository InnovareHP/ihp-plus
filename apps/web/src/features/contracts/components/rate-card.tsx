'use client'

import { Alert, Button, Group, Skeleton, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { LookupOptionsModal } from '@/components/lookup-options-modal'
import { PageSection } from '@/components/page-section'
import { EmptyState } from '@/components/empty-state'
import { useLookupLists } from '@/features/lookups/hooks/use-lookup-admin'
import { offerUndo } from '@/lib/undo'
import { contractKeys } from '../query-keys'
import { groupBySection } from '../catalog-sections'
import { CATALOG_LOOKUP_KINDS, type CatalogItemRow } from '../schema'
import { useCatalog, useSetCatalogItemArchived } from '../use-contracts'
import { CatalogItemActions } from './catalog-item-actions'
import { CatalogItemFormModal } from './catalog-item-form-modal'
import { CategoryTable } from './category-table'

/** The published rate card, grouped under the sections an admin curates. */
export function RateCard({ canManage }: { canManage: boolean }) {
  // A manager's card also holds the archived services, so they can be brought back.
  const catalog = useCatalog(canManage)
  const lists = useLookupLists(CATALOG_LOOKUP_KINDS)
  const archive = useSetCatalogItemArchived()
  const queryClient = useQueryClient()
  const [adding, addModal] = useDisclosure(false)
  const [managing, manageModal] = useDisclosure(false)
  // Which service the edit modal is open on is a disclosure nothing else reads.
  const [editing, setEditing] = useState<CatalogItemRow | undefined>(undefined)

  const sections = lists.data?.catalogSection ?? []
  const active = catalog.data?.filter((item) => !item.archived) ?? []
  const archived = catalog.data?.filter((item) => item.archived) ?? []

  function archiveWithUndo(item: CatalogItemRow) {
    // Undo over confirm: the row leaves at once, and the server is only told when the toast closes.
    const key = contractKeys.catalog(true)
    const previous = queryClient.getQueryData<CatalogItemRow[]>(key)
    queryClient.setQueryData<CatalogItemRow[]>(key, (rows) =>
      rows?.map((row) => (row.id === item.id ? { ...row, archived: true } : row)),
    )
    offerUndo({
      message: `Archived ${item.name}`,
      undoLabel: 'Undo',
      onUndo: () => queryClient.setQueryData(key, previous),
      onCommit: () => archive.mutate({ itemId: item.id, archived: true }),
    })
  }

  const rowActions = canManage
    ? (item: CatalogItemRow) => (
        <CatalogItemActions
          item={item}
          onEdit={setEditing}
          onArchive={archiveWithUndo}
          onRestore={(row) => archive.mutate({ itemId: row.id, archived: false })}
        />
      )
    : undefined

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
      {editing ? (
        <CatalogItemFormModal
          key={editing.id}
          opened
          onClose={() => setEditing(undefined)}
          sections={sections}
          onManageSections={manageModal.open}
          item={editing}
        />
      ) : null}
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

  if (active.length === 0 && archived.length === 0) {
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
      {active.length === 0 ? (
        <EmptyState
          title="Every service is archived"
          description="Restore one below, or add a new service to price contracts from."
        />
      ) : null}
      {groupBySection(active, sections).map(({ section, items }) => (
        <PageSection key={section} title={section}>
          <CategoryTable label={section} items={items} actions={rowActions} />
        </PageSection>
      ))}
      {canManage && archived.length > 0 ? (
        <PageSection
          title="Archived services"
          description="Off the rate card and the contract picker. Contracts already priced from them are unchanged."
        >
          <CategoryTable label="Archived services" items={archived} actions={rowActions} />
        </PageSection>
      ) : null}
      {modals}
    </Stack>
  )
}
