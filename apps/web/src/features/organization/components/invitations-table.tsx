'use client'

import { Badge, Button, Group, Menu, Stack, Text } from '@mantine/core'
import { useMemo } from 'react'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { useClientPagination } from '@/lib/use-client-pagination'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { useCancelInvitation, useInvitations, useResendInvitation } from '../hooks/use-invitations'
import { DEFAULT_INVITATION_QUERY, invitationQuerySchema, type InvitationRow } from '../schema'

const expires = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const parseInvitationQuery = searchParamsParser(invitationQuerySchema)

const INVITATION_FILTERS: readonly FilterControl[] = [
  {
    kind: 'select',
    key: 'role',
    label: 'Organization role',
    options: [
      { value: 'admin', label: 'Admin' },
      { value: 'member', label: 'Member' },
    ],
  },
  {
    kind: 'toggle',
    key: 'expiredOnly',
    label: 'Only expired invitations',
    help: 'The ones that lapsed before anyone accepted them.',
  },
]

export function InvitationsTable() {
  const invitations = useInvitations()
  const cancel = useCancelInvitation()
  const resend = useResendInvitation()
  const { query, setQuery, clearFilters } = useUrlQuery(
    parseInvitationQuery,
    DEFAULT_INVITATION_QUERY,
  )

  const term = query.search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      invitations.data?.filter(
        (row) =>
          (row.email.toLowerCase().includes(term) ||
            (row.teamName ?? '').toLowerCase().includes(term)) &&
          (!query.role || row.role === query.role) &&
          (!query.expiredOnly || row.expired),
      ),
    [invitations.data, term, query.role, query.expiredOnly],
  )
  const isFiltered = term.length > 0 || Boolean(query.role) || query.expiredOnly
  const paged = useClientPagination(rows)

  const columns: DataTableColumn<InvitationRow>[] = [
    {
      key: 'email',
      header: 'Invited',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.email}
          </Text>
          <Text size="xs" c="dimmed">
            by {row.invitedBy}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'team',
      header: 'Department',
      render: (row) => <Text size="sm">{row.teamName ?? '—'}</Text>,
    },
    {
      key: 'role',
      header: 'Role',
      width: 120,
      render: (row) => (
        <Badge variant="light" tt="capitalize">
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      width: 200,
      render: (row) => (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" c={row.expired ? 'red' : 'dimmed'}>
            {expires.format(new Date(row.expiresAt))}
          </Text>
          {row.expired ? (
            <Badge color="red" variant="light" size="sm">
              Expired
            </Badge>
          ) : null}
        </Group>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) => (
        <RowActionsMenu
          name={`the invitation to ${row.email}`}
          loading={resend.isPending && resend.variables?.invitationId === row.id}
        >
          <Menu.Item onClick={() => resend.mutate({ invitationId: row.id, email: row.email })}>
            Resend
          </Menu.Item>
          <Menu.Item color="red" onClick={() => cancel.mutate({ invitationId: row.id })}>
            Cancel
          </Menu.Item>
        </RowActionsMenu>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="invitations"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={INVITATION_FILTERS}
      />

      <DataTable
        label="Pending invitations"
        columns={columns}
        rows={paged.rows}
        pageInfo={paged.pageInfo}
        onPageChange={paged.onPageChange}
        onPageSizeChange={paged.onPageSizeChange}
        rowKey={(row) => row.id}
        isPending={invitations.isPending}
        isError={invitations.isError}
        isFetching={invitations.isFetching}
        error={invitations.error}
        onRetry={() => invitations.refetch()}
        minWidth={760}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="No invitations match those filters"
            description="Clear them to see everyone still waiting to accept."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="No invitations waiting"
            description="Invite a colleague above and their invitation appears here until they accept it."
          />
        }
      />
    </Stack>
  )
}
