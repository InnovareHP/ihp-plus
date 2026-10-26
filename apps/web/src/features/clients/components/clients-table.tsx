'use client'

import { Badge, Button, Group, Menu, SegmentedControl, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAdjustments, IconPlus } from '@tabler/icons-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { LookupOptionsModal } from '@/components/lookup-options-modal'
import { ClientAccessModal } from '@/features/drive/components/client-access-modal'
import { EmptyState } from '@/components/empty-state'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { offerUndo } from '@/lib/undo'
import {
  CLIENT_LOOKUP_KINDS,
  CLIENT_STATUS_COLORS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUSES,
  draftOf,
  emptyOptionMap,
  isFilteredClientQuery,
  type ClientLookupKind,
  type ClientRow,
  type ClientSortKey,
} from '../schema'
import { useClientQuery } from '../hooks/use-client-query'
import {
  useArchiveClient,
  useClientFilterOptions,
  useClients,
  useCreateClient,
  useRestoreClient,
  useUpdateClient,
} from '../hooks/use-clients'
import { ClientFormModal } from './client-form-modal'

const STATUS_OPTIONS = CLIENT_STATUSES.map((status) => ({
  value: status,
  label: CLIENT_STATUS_LABELS[status],
}))

const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

// Absolute date with a relative hint, per .claude/rules/frontend-patterns.md.
function contactedAt(iso: string | undefined) {
  if (!iso) return '—'
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000)
  return `${day.format(new Date(iso))} · ${relative.format(days, 'day')}`
}

export function ClientsTable() {
  const { query, setQuery, clearFilters } = useClientQuery()
  const clients = useClients(query)
  const filterOptions = useClientFilterOptions()
  const options = filterOptions.data?.options ?? emptyOptionMap()
  const owners = filterOptions.data?.owners ?? []
  const ownerNameOf = (ownerId: string) => owners.find((owner) => owner.id === ownerId)?.name ?? ''

  const create = useCreateClient(query, ownerNameOf)
  const update = useUpdateClient(query, ownerNameOf)
  const archive = useArchiveClient(query)
  const restore = useRestoreClient(query)

  const [createOpened, createModal] = useDisclosure(false)
  // ?compose=new (global search's "New client") opens the same form; it stays out of the list
  // query so the cached rows, the page number and the optimistic insert are untouched.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const linkedCreate = searchParams.get('compose') === 'new'
  const creating = createOpened || linkedCreate

  function closeCreate() {
    createModal.close()
    if (!linkedCreate) return
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('compose')
    router.replace(rest.size > 0 ? `${pathname}?${rest}` : pathname, { scroll: false })
  }
  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [managing, setManaging] = useState<ClientLookupKind | null>(null)
  const [sharing, setSharing] = useState<ClientRow | null>(null)

  const ownerOptions = [
    { value: 'unassigned', label: 'Unassigned' },
    ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
  ]

  // Undo instead of a confirm dialog: archiving is reversible, so it applies first and undo restores.
  function archiveWithUndo(row: ClientRow) {
    archive.mutate(
      { id: row.id, name: row.name },
      {
        onSuccess: () =>
          offerUndo({
            message: `Archived ${row.name}`,
            undoLabel: 'Undo',
            onUndo: () => restore.mutate({ id: row.id }),
            onCommit: () => {},
          }),
      },
    )
  }

  const valuesOf = (kind: ClientLookupKind) =>
    (options[kind] ?? []).map((value) => ({ value, label: value }))

  // Same query keys as before the drawer, so existing links keep their filters.
  const filters: FilterControl[] = [
    { kind: 'multi', key: 'statuses', label: 'Status', options: STATUS_OPTIONS },
    { kind: 'multi', key: 'ownerIds', label: 'Owner', options: ownerOptions },
    { kind: 'multi', key: 'types', label: 'Type', options: valuesOf('clientType') },
    {
      kind: 'multi',
      key: 'serviceLines',
      label: 'Service line',
      options: valuesOf('clientServiceLine'),
    },
    { kind: 'multi', key: 'tags', label: 'Tags', options: valuesOf('clientTag') },
  ]

  const columns: DataTableColumn<ClientRow>[] = [
    {
      key: 'name',
      header: 'Client',
      rowHeader: true,
      sortable: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed">
            {row.contactName || 'No contact named'}
          </Text>
          {row.tags.length > 0 ? (
            <Group gap={4} mt={4}>
              {row.tags.map((tag) => (
                <Badge key={tag} size="xs" variant="outline" color="gray">
                  {tag}
                </Badge>
              ))}
            </Group>
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      stackOnPhone: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm">{row.email || '—'}</Text>
          <Text size="xs" c="dimmed">
            {row.phone || '—'}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: 130,
      render: (row) => (
        <Badge color={CLIENT_STATUS_COLORS[row.status]} variant="light">
          {CLIENT_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      stackOnPhone: true,
      sortable: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm">{row.type || '—'}</Text>
          <Text size="xs" c="dimmed">
            {row.serviceLine || '—'}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      hideOnPhone: true,
      render: (row) => <Text size="sm">{row.ownerName || 'Unassigned'}</Text>,
    },
    {
      key: 'city',
      header: 'Location',
      hideOnPhone: true,
      sortable: true,
      render: (row) => (
        <Text size="sm">{[row.city, row.state].filter(Boolean).join(', ') || '—'}</Text>
      ),
    },
    {
      key: 'lastContactAt',
      header: 'Last contact',
      sortable: true,
      width: 190,
      render: (row) => (
        <Text size="sm" c={row.lastContactAt ? undefined : 'dimmed'}>
          {contactedAt(row.lastContactAt)}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) => (
        <RowActionsMenu name={row.name}>
          <Menu.Item onClick={() => setEditing(row)}>Edit</Menu.Item>
          <Menu.Item onClick={() => setSharing(row)}>Folder access</Menu.Item>
          {row.archivedAt ? (
            <Menu.Item onClick={() => restore.mutate({ id: row.id })}>Restore</Menu.Item>
          ) : (
            <Menu.Item onClick={() => archiveWithUndo(row)}>Archive</Menu.Item>
          )}
        </RowActionsMenu>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="clients"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
        action={
          <>
            <SegmentedControl
              aria-label="Which clients to show"
              value={query.view}
              onChange={(view) => setQuery({ view: view as typeof query.view })}
              data={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <Button
              variant="default"
              mih={{ base: 44, sm: 0 }}
              leftSection={<IconAdjustments size={16} aria-hidden />}
              onClick={() => setManaging('clientType')}
            >
              Manage options
            </Button>
          </>
        }
        primaryAction={
          <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={createModal.open}>
            New client
          </Button>
        }
      />

      <DataTable
        label="Clients"
        columns={columns}
        rows={clients.data?.rows}
        rowKey={(row) => row.id}
        isPending={clients.isPending}
        isError={clients.isError}
        error={clients.error}
        onRetry={() => clients.refetch()}
        // Only a page or filter change keeps a stale page on screen; a plain refetch stays silent.
        isFetching={clients.isPlaceholderData}
        isFiltered={isFilteredClientQuery(query)}
        minWidth={900}
        empty={
          query.view === 'archived' ? (
            <EmptyState
              title="Nothing archived"
              description="Archived clients land here, and you can restore any of them."
              action={
                <Button variant="default" onClick={() => setQuery({ view: 'active' })}>
                  Back to active clients
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No clients yet"
              description="Add your first client to start tracking owners, status and follow-ups."
              action={<Button onClick={createModal.open}>New client</Button>}
            />
          )
        }
        noResults={
          <EmptyState
            title="No clients match these filters"
            description="Widen the search or clear the filters to see the full list again."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        pageInfo={clients.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        onPageSizeChange={(pageSize) => setQuery({ pageSize, page: 1 })}
        sort={{ key: query.sortBy, direction: query.sortDirection }}
        onSortChange={({ key, direction }) =>
          setQuery({ sortBy: key as ClientSortKey, sortDirection: direction })
        }
      />

      <ClientFormModal
        opened={creating}
        onClose={closeCreate}
        title="New client"
        submitLabel="Add client"
        owners={ownerOptions.slice(1)}
        options={options}
        onManageOptions={setManaging}
        onSave={async (values) => {
          await create.mutateAsync(values)
        }}
      />

      <ClientFormModal
        opened={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? 'client'}`}
        submitLabel="Save changes"
        owners={ownerOptions.slice(1)}
        options={options}
        onManageOptions={setManaging}
        clientId={editing?.id}
        defaults={editing ? draftOf(editing) : undefined}
        onSave={async (values) => {
          if (!editing) return
          await update.mutateAsync({ ...values, id: editing.id })
        }}
      />

      <ClientAccessModal
        opened={Boolean(sharing)}
        onClose={() => setSharing(null)}
        client={sharing}
      />

      <LookupOptionsModal
        opened={managing !== null}
        onClose={() => setManaging(null)}
        kinds={CLIENT_LOOKUP_KINDS}
        lists={options}
        initialKind={managing ?? 'clientType'}
      />
    </Stack>
  )
}
