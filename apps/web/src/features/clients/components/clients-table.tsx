'use client'

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  MultiSelect,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAdjustments, IconDotsVertical, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { LookupOptionsModal } from '@/components/lookup-options-modal'
import { ClientAccessModal } from '@/features/drive/components/client-access-modal'
import { EmptyState } from '@/components/empty-state'
import { SearchField } from '@/components/search-field'
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
  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [managing, setManaging] = useState<ClientLookupKind | null>(null)
  const [sharing, setSharing] = useState<ClientRow | null>(null)

  const ownerOptions = [
    { value: 'unassigned', label: 'Unassigned' },
    ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
  ]

  // Undo instead of a confirm dialog: archiving is reversible, so it applies first.
  function archiveWithUndo(row: ClientRow) {
    archive.mutate(
      { id: row.id, name: row.name },
      {
        onSuccess: () =>
          notifications.show({
            message: (
              <Group gap="sm" justify="space-between" wrap="nowrap">
                <Text size="sm">Archived {row.name}</Text>
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

  const valuesOf = (kind: ClientLookupKind) => options[kind] ?? []

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
      render: (row) => <Text size="sm">{row.ownerName || 'Unassigned'}</Text>,
    },
    {
      key: 'city',
      header: 'Location',
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
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${row.name}`}>
              <IconDotsVertical size={16} aria-hidden />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setEditing(row)}>Edit</Menu.Item>
            <Menu.Item onClick={() => setSharing(row)}>Folder access</Menu.Item>
            {row.archivedAt ? (
              <Menu.Item onClick={() => restore.mutate({ id: row.id })}>Restore</Menu.Item>
            ) : (
              <Menu.Item onClick={() => archiveWithUndo(row)}>Archive</Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        {/* A search landmark: the filter bar is its own region, separate from the table. */}
        <Group role="search" aria-label="Filter clients" align="flex-end" wrap="wrap" gap="sm">
          <SearchField
            label="clients"
            labelVisible
            placeholder="Name, contact, email, phone"
            width={260}
            initial={query.search}
            onSearch={(search) => setQuery({ search })}
          />
          <MultiSelect
            label="Status"
            placeholder={query.statuses.length > 0 ? undefined : 'Any'}
            data={STATUS_OPTIONS}
            value={query.statuses}
            onChange={(statuses) => setQuery({ statuses: statuses as typeof query.statuses })}
            clearable
            w={{ base: '100%', sm: 200 }}
          />
          <MultiSelect
            label="Owner"
            placeholder={query.ownerIds.length > 0 ? undefined : 'Anyone'}
            data={ownerOptions}
            value={query.ownerIds}
            onChange={(ownerIds) => setQuery({ ownerIds })}
            clearable
            searchable
            w={{ base: '100%', sm: 220 }}
          />
          <MultiSelect
            label="Type"
            placeholder={query.types.length > 0 ? undefined : 'Any'}
            data={valuesOf('clientType')}
            value={query.types}
            onChange={(types) => setQuery({ types })}
            clearable
            searchable
            w={{ base: '100%', sm: 200 }}
          />
          <MultiSelect
            label="Service line"
            placeholder={query.serviceLines.length > 0 ? undefined : 'Any'}
            data={valuesOf('clientServiceLine')}
            value={query.serviceLines}
            onChange={(serviceLines) => setQuery({ serviceLines })}
            clearable
            searchable
            w={{ base: '100%', sm: 200 }}
          />
          <MultiSelect
            label="Tags"
            placeholder={query.tags.length > 0 ? undefined : 'Any'}
            data={valuesOf('clientTag')}
            value={query.tags}
            onChange={(tags) => setQuery({ tags })}
            clearable
            searchable
            w={{ base: '100%', sm: 200 }}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500} component="span" id="clients-view-label">
              View
            </Text>
            <SegmentedControl
              aria-labelledby="clients-view-label"
              value={query.view}
              onChange={(view) => setQuery({ view: view as typeof query.view })}
              data={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </Stack>
        </Group>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconAdjustments size={16} aria-hidden />}
            onClick={() => setManaging('clientType')}
          >
            Manage options
          </Button>
          <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={createModal.open}>
            New client
          </Button>
        </Group>
      </Group>

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
        minWidth={1120}
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
        opened={createOpened}
        onClose={createModal.close}
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
