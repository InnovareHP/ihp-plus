'use client'

import {
  ActionIcon,
  Badge,
  Button,
  Flex,
  Group,
  Menu,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAdjustments,
  IconDotsVertical,
  IconExternalLink,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { LinkButton } from '@/components/link-button'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { LookupOptionsModal } from '@/components/lookup-options-modal'
import { EmptyState } from '@/components/empty-state'
import { organizationTab } from '@/lib/routes'
import {
  BLUEBOOK_LOOKUP_KINDS,
  draftOf,
  formatBytes,
  isFilteredBluebookQuery,
  type BluebookSortKey,
  type DocumentRow,
} from '../schema'
import { useBluebookQuery } from '../hooks/use-bluebook-query'
import {
  useAcknowledgeDocument,
  useArchiveDocument,
  useBluebookOptions,
  useDocuments,
  useOpenDocument,
  usePurgeDocument,
  useRestoreDocument,
  useUpdateDocument,
  useUploadDocument,
} from '../hooks/use-bluebook'
import { fileLook } from '../utils/file-look'
import { ShelfPicker } from './shelf-picker'
import { ShelfRail } from './shelf-rail'
import { UploadDocumentModal } from './upload-document-modal'

const filed = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export function BluebookLibrary() {
  const { query, setQuery, clearFilters } = useBluebookQuery()
  const documents = useDocuments(query)
  const options = useBluebookOptions()
  const upload = useUploadDocument(query)
  const update = useUpdateDocument(query)
  const archive = useArchiveDocument(query)
  const restore = useRestoreDocument(query)
  const purge = usePurgeDocument(query)
  const open = useOpenDocument()
  const acknowledge = useAcknowledgeDocument(query)

  const [uploadOpened, uploadModal] = useDisclosure(false)
  const [categoriesOpened, categoriesModal] = useDisclosure(false)
  const [editing, setEditing] = useState<DocumentRow | null>(null)

  const shelves = options.data?.shelves ?? []
  const uploadable = shelves.filter((shelf) => shelf.canUpload)
  const isAdmin = options.data?.isAdmin ?? false
  const categories = options.data?.categories ?? []

  // Undo instead of a confirm dialog: archiving is reversible, so it applies first.
  function archiveWithUndo(row: DocumentRow) {
    archive.mutate(
      { id: row.id, title: row.title },
      {
        onSuccess: () =>
          notifications.show({
            message: (
              <Group gap="sm" justify="space-between" wrap="nowrap">
                <Text size="sm">Archived {row.title}</Text>
                <Button
                  size="compact-sm"
                  variant="subtle"
                  onClick={() => restore.mutate({ id: row.id })}
                >
                  Undo
                </Button>
              </Group>
            ),
            autoClose: 10_000,
          }),
      },
    )
  }

  const columns: DataTableColumn<DocumentRow>[] = [
    {
      key: 'title',
      header: 'Document',
      rowHeader: true,
      sortable: true,
      render: (row) => {
        const look = fileLook(row.contentType)

        return (
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <ThemeIcon variant="light" color={look.color} size={38} radius="md">
              <look.Icon size={20} aria-hidden />
            </ThemeIcon>
            <Stack gap={2} miw={0}>
              <Text size="sm" fw={600}>
                {row.title}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {row.description || row.fileName}
              </Text>
            </Stack>
          </Group>
        )
      },
    },
    {
      key: 'teamName',
      header: 'Filed under',
      width: 220,
      render: (row) =>
        row.teams.length === 0 ? (
          <Badge variant="filled" color="brand">
            All departments
          </Badge>
        ) : (
          <Group gap={4} wrap="wrap">
            {row.teams.map((team) => (
              <Badge key={team.id} variant="light" color="gray">
                {team.name}
              </Badge>
            ))}
          </Group>
        ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      width: 150,
      render: (row) =>
        row.category ? (
          <Badge variant="default" radius="sm">
            {row.category}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: 'byteSize',
      header: 'File',
      sortable: true,
      width: 150,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" lineClamp={1}>
            {row.fileName}
          </Text>
          <Text size="xs" c="dimmed">
            {formatBytes(row.byteSize)}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'createdAt',
      header: 'Added',
      sortable: true,
      width: 170,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm">{filed.format(new Date(row.createdAt))}</Text>
          <Text size="xs" c="dimmed">
            {row.uploadedByName || 'Unknown'}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'read',
      header: 'Read',
      width: 150,
      render: (row) =>
        row.archivedAt ? (
          <Text size="xs" c="dimmed">
            Archived
          </Text>
        ) : (
          <Stack gap={4} align="flex-start">
            {row.acknowledgedAt ? (
              <Badge color="green" variant="light">
                Read
              </Badge>
            ) : (
              <Button
                size="compact-sm"
                variant="default"
                // Starts with the visible words, so a voice user saying "Mark as read" reaches it.
                aria-label={`Mark as read: ${row.title}`}
                onClick={() => acknowledge.mutate({ id: row.id })}
              >
                Mark as read
              </Button>
            )}
            {row.readCount !== undefined && row.audienceCount !== undefined ? (
              <Text size="xs" c="dimmed">
                {row.readCount} of {row.audienceCount} read
              </Text>
            ) : null}
          </Stack>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 120,
      align: 'right',
      render: (row) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<IconExternalLink size={14} aria-hidden />}
            aria-label={`Open ${row.title}`}
            loading={open.isPending && open.variables === row.id}
            onClick={() => open.mutate(row.id)}
          >
            Open
          </Button>
          {row.canManage ? (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${row.title}`}>
                  <IconDotsVertical size={16} aria-hidden />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => setEditing(row)}>Edit details</Menu.Item>
                {row.archivedAt ? (
                  <Menu.Item onClick={() => restore.mutate({ id: row.id })}>Restore</Menu.Item>
                ) : (
                  <Menu.Item onClick={() => archiveWithUndo(row)}>Archive</Menu.Item>
                )}
                {isAdmin && row.archivedAt ? (
                  <Menu.Item color="red" onClick={() => purge.mutate({ id: row.id })}>
                    Delete for good
                  </Menu.Item>
                ) : null}
              </Menu.Dropdown>
            </Menu>
          ) : null}
        </Group>
      ),
    },
  ]

  const filters: readonly FilterControl[] = [
    {
      kind: 'multi',
      key: 'categories',
      label: 'Category',
      options: categories.map((category) => ({ value: category, label: category })),
    },
  ]

  const shelfItems = [
    {
      value: '',
      label: 'Everything',
      count: shelves.reduce((sum, shelf) => sum + shelf.documentCount, 0),
    },
    ...shelves.map((shelf) => ({
      value: shelf.value,
      label: shelf.label,
      count: shelf.documentCount,
    })),
  ]

  return (
    <Stack gap="md">
      <Flex gap="lg" align="flex-start" direction={{ base: 'column', md: 'row' }}>
        <ShelfRail
          items={shelfItems}
          value={query.shelf}
          onChange={(shelf) => setQuery({ shelf })}
        />
        <ShelfPicker
          items={shelfItems}
          value={query.shelf}
          onChange={(shelf) => setQuery({ shelf })}
        />

        <Stack gap="md" flex={1} miw={0} w={{ base: '100%', md: 'auto' }}>
          <TableToolbar
            label="the bluebook"
            query={query}
            setQuery={setQuery}
            clearFilters={clearFilters}
            filters={filters}
            action={
              <Group gap="sm" wrap="wrap">
                <SegmentedControl
                  aria-label="Which documents to show"
                  value={query.view}
                  onChange={(view) => setQuery({ view: view as typeof query.view })}
                  data={[
                    { value: 'active', label: 'Current' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                />
                {isAdmin ? (
                  <LinkButton
                    variant="default"
                    leftSection={<IconUsers size={16} aria-hidden />}
                    href={organizationTab('departments')}
                  >
                    Department leads
                  </LinkButton>
                ) : null}
                {isAdmin ? (
                  <Button
                    variant="default"
                    leftSection={<IconAdjustments size={16} aria-hidden />}
                    onClick={categoriesModal.open}
                  >
                    Categories
                  </Button>
                ) : null}
                {uploadable.length > 0 ? (
                  <Button
                    leftSection={<IconUpload size={16} aria-hidden />}
                    onClick={uploadModal.open}
                  >
                    Upload file
                  </Button>
                ) : null}
              </Group>
            }
          />

          <DataTable
            label="Bluebook documents"
            columns={columns}
            rows={documents.data?.rows}
            rowKey={(row) => row.id}
            isPending={documents.isPending}
            isError={documents.isError}
            error={documents.error}
            onRetry={() => documents.refetch()}
            // Only a page or filter change keeps a stale page on screen; a plain refetch stays silent.
            isFetching={documents.isPlaceholderData}
            isFiltered={isFilteredBluebookQuery(query)}
            // Narrower than the other tables: the rail takes 240px of the row.
            minWidth={840}
            density="comfortable"
            empty={
              query.view === 'archived' ? (
                <EmptyState
                  title="Nothing archived"
                  description="Documents taken off a shelf land here, and can be restored."
                  action={
                    <Button variant="default" onClick={() => setQuery({ view: 'active' })}>
                      Back to the current bluebook
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="The bluebook is empty"
                  description="Upload the first policy, form or training document so everyone reads the same thing."
                  action={
                    uploadable.length > 0 ? (
                      <Button onClick={uploadModal.open}>Upload file</Button>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Ask an admin or your department lead to add one.
                      </Text>
                    )
                  }
                />
              )
            }
            noResults={
              <EmptyState
                title="No documents match these filters"
                description="Widen the search or clear the filters to see the whole bluebook again."
                action={
                  <Button variant="default" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            }
            pageInfo={documents.data?.pageInfo}
            onPageChange={(page) => setQuery({ page })}
            sort={{ key: query.sortBy, direction: query.sortDirection }}
            onSortChange={({ key, direction }) =>
              setQuery({ sortBy: key as BluebookSortKey, sortDirection: direction })
            }
          />
        </Stack>
      </Flex>

      <UploadDocumentModal
        opened={uploadOpened}
        onClose={uploadModal.close}
        title="Upload to the bluebook"
        submitLabel="Add to bluebook"
        shelves={uploadable}
        categories={categories}
        canManageCategories={isAdmin}
        onManageCategories={categoriesModal.open}
        onUpload={async (values, file) => {
          const formData = new FormData()
          formData.set('title', values.title)
          formData.set('description', values.description)
          formData.set('category', values.category)
          // Repeated rather than joined: a department name may contain any character.
          for (const shelf of values.shelves) formData.append('shelves', shelf)
          formData.set('file', file)
          await upload.mutateAsync(formData)
        }}
      />

      <UploadDocumentModal
        opened={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.title ?? 'document'}`}
        submitLabel="Save details"
        shelves={uploadable}
        categories={categories}
        canManageCategories={isAdmin}
        onManageCategories={categoriesModal.open}
        defaults={editing ? draftOf(editing) : undefined}
        onSave={async (values) => {
          if (!editing) return
          await update.mutateAsync({ ...values, id: editing.id })
        }}
      />

      <LookupOptionsModal
        opened={categoriesOpened}
        onClose={categoriesModal.close}
        kinds={BLUEBOOK_LOOKUP_KINDS}
        lists={{ bluebookCategory: categories }}
        initialKind="bluebookCategory"
      />
    </Stack>
  )
}
