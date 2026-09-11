'use client'

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAdjustments,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { LookupOptionsModal } from '@/components/lookup-options-modal'
import { EmptyState } from '@/components/page-shell'
import {
  BLUEBOOK_LOOKUP_KINDS,
  draftOf,
  formatBytes,
  isFilteredBluebookQuery,
  shelfLabel,
  type BluebookSortKey,
  type DocumentRow,
} from '../schema'
import { useBluebookQuery } from '../use-bluebook-query'
import {
  useArchiveDocument,
  useBluebookOptions,
  useDocuments,
  useOpenDocument,
  usePurgeDocument,
  useRestoreDocument,
  useUpdateDocument,
  useUploadDocument,
} from '../use-bluebook'
import { DepartmentLeadsModal } from './department-leads-modal'
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

  const [uploadOpened, uploadModal] = useDisclosure(false)
  const [leadsOpened, leadsModal] = useDisclosure(false)
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
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.title}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {row.description || row.fileName}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'teamName',
      header: 'Filed under',
      sortable: true,
      width: 180,
      render: (row) => (
        <Badge
          variant={row.teamId === '' ? 'filled' : 'light'}
          color={row.teamId === '' ? 'brand' : 'gray'}
        >
          {shelfLabel(row)}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      width: 150,
      render: (row) => <Text size="sm">{row.category || '—'}</Text>,
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
      key: 'actions',
      header: 'Actions',
      width: 120,
      align: 'right',
      render: (row) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            aria-label={`Open ${row.title}`}
            loading={open.isPending && open.variables === row.id}
            onClick={() => open.mutate(row.id)}
          >
            <IconDownload size={16} aria-hidden />
          </ActionIcon>
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

  return (
    <Stack gap="md">
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
            <Button
              variant="default"
              leftSection={<IconUsers size={16} aria-hidden />}
              onClick={leadsModal.open}
            >
              Department leads
            </Button>
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
              <Button leftSection={<IconUpload size={16} aria-hidden />} onClick={uploadModal.open}>
                Upload file
              </Button>
            ) : null}
          </Group>
        }
      />

      <ShelfTabs
        shelves={shelves.map((shelf) => ({
          value: shelf.value,
          label: shelf.label,
          count: shelf.documentCount,
        }))}
        value={query.shelf}
        onChange={(shelf) => setQuery({ shelf })}
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
        minWidth={1040}
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
          formData.set('shelf', values.shelf)
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

      <DepartmentLeadsModal opened={leadsOpened} onClose={leadsModal.close} canEdit={isAdmin} />

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

/** The shelves, as tabs: the company-wide one first, then a department per tab. */
function ShelfTabs({
  shelves,
  value,
  onChange,
}: {
  shelves: { value: string; label: string; count: number }[]
  value: string
  onChange: (value: string) => void
}) {
  if (shelves.length === 0) return null

  return (
    <Group gap="xs" role="tablist" aria-label="Bluebook shelves" wrap="wrap">
      <ShelfTab label="Everything" value="" active={value === ''} onChange={onChange} />
      {shelves.map((shelf) => (
        <ShelfTab
          key={shelf.value}
          label={shelf.label}
          count={shelf.count}
          value={shelf.value}
          active={value === shelf.value}
          onChange={onChange}
        />
      ))}
    </Group>
  )
}

function ShelfTab({
  label,
  count,
  value,
  active,
  onChange,
}: {
  label: string
  count?: number
  value: string
  active: boolean
  onChange: (value: string) => void
}) {
  return (
    <Button
      role="tab"
      aria-selected={active}
      variant={active ? 'light' : 'subtle'}
      color={active ? 'brand' : 'gray'}
      size="compact-sm"
      onClick={() => onChange(value)}
      rightSection={
        count === undefined ? undefined : (
          <Badge size="xs" variant="transparent" c="dimmed">
            {count}
          </Badge>
        )
      }
    >
      {label}
    </Button>
  )
}
