'use client'

import { Badge, Button, Menu, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { LinkButton } from '@/components/link-button'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { careersPostingRoute, NEW_POSTING_ROUTE, postingRoute } from '@/lib/routes'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
// Departments are organization data; hiring is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import { useDeleteDraftWithUndo, usePostings, useSetPostingStatus } from '../hooks/use-postings'
import {
  DEFAULT_POSTING_QUERY,
  EMPLOYMENT_TYPE_LABELS,
  isFilteredPostingQuery,
  POSTING_STATUS_COLORS,
  POSTING_STATUS_FILTER_OPTIONS,
  POSTING_STATUS_LABELS,
  postingQuerySchema,
  WORKPLACE_LABELS,
  type PostingRow,
} from '../schema'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

const parsePostingQuery = searchParamsParser(postingQuerySchema, ['teamIds'])

export function PostingsTable() {
  const { query, setQuery, clearFilters } = useUrlQuery(parsePostingQuery, DEFAULT_POSTING_QUERY)
  const postings = usePostings(query)
  const teams = useTeams()
  const setStatus = useSetPostingStatus()
  const deleteWithUndo = useDeleteDraftWithUndo()

  const filters: readonly FilterControl[] = [
    { kind: 'select', key: 'status', label: 'Status', options: POSTING_STATUS_FILTER_OPTIONS },
    {
      kind: 'multi',
      key: 'teamIds',
      label: 'Department',
      options: (teams.data ?? []).map((team) => ({ value: team.id, label: team.name })),
    },
  ]

  const columns: DataTableColumn<PostingRow>[] = [
    {
      key: 'title',
      header: 'Job',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Link href={postingRoute(row.id)}>{row.title}</Link>
          <Text size="xs" c="dimmed">
            {[
              row.teamName,
              EMPLOYMENT_TYPE_LABELS[row.employmentType],
              WORKPLACE_LABELS[row.workplace],
              row.location,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      render: (row) => (
        <Badge color={POSTING_STATUS_COLORS[row.status]} variant="light">
          {POSTING_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'applicants',
      header: 'Applicants',
      width: 140,
      render: (row) =>
        row.applicantCount === 0 ? (
          <Text size="sm" c="dimmed">
            None yet
          </Text>
        ) : (
          <Stack gap={0}>
            <Text size="sm">{row.activeCount} in progress</Text>
            <Text size="xs" c="dimmed">
              {row.applicantCount} in total
            </Text>
          </Stack>
        ),
    },
    {
      key: 'closes',
      header: 'Closes',
      width: 140,
      render: (row) =>
        row.closesAt ? (
          <Text size="sm">{dateOnly.format(new Date(row.closesAt))}</Text>
        ) : (
          <Text size="sm" c="dimmed">
            No end date
          </Text>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) => (
        <RowActionsMenu name={row.title}>
          <Menu.Item component={Link} href={postingRoute(row.id)}>
            Open
          </Menu.Item>
          {row.status === 'open' ? (
            <Menu.Item component={Link} href={careersPostingRoute(row.slug)} target="_blank">
              View public page
            </Menu.Item>
          ) : null}
          {row.status === 'draft' || row.status === 'closed' ? (
            <Menu.Item onClick={() => setStatus.mutate({ postingId: row.id, status: 'open' })}>
              {row.status === 'draft' ? 'Publish' : 'Reopen'}
            </Menu.Item>
          ) : null}
          {row.status === 'open' ? (
            <Menu.Item onClick={() => setStatus.mutate({ postingId: row.id, status: 'closed' })}>
              Stop taking applications
            </Menu.Item>
          ) : null}
          {row.status === 'archived' ? (
            <Menu.Item onClick={() => setStatus.mutate({ postingId: row.id, status: 'closed' })}>
              Restore
            </Menu.Item>
          ) : row.status === 'draft' && row.applicantCount === 0 ? (
            <Menu.Item color="red" onClick={() => deleteWithUndo(row)}>
              Delete draft
            </Menu.Item>
          ) : (
            <Menu.Item
              color="red"
              onClick={() => setStatus.mutate({ postingId: row.id, status: 'archived' })}
            >
              Archive
            </Menu.Item>
          )}
        </RowActionsMenu>
      ),
    },
  ]

  const visibleRows = postings.data?.rows

  return (
    <Stack gap="md">
      <TableToolbar
        label="job postings"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
        action={
          <LinkButton href={NEW_POSTING_ROUTE} leftSection={<IconPlus size={16} aria-hidden />}>
            New posting
          </LinkButton>
        }
      />

      <DataTable
        label="Job postings"
        columns={columns}
        rows={visibleRows}
        rowKey={(row) => row.id}
        pageInfo={postings.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        onPageSizeChange={(pageSize) => setQuery({ pageSize, page: 1 })}
        isPending={postings.isPending}
        isError={postings.isError}
        isFetching={postings.isPlaceholderData}
        error={postings.error}
        onRetry={() => postings.refetch()}
        isFiltered={isFilteredPostingQuery(query)}
        minWidth={760}
        empty={
          <EmptyState
            title="No job postings yet"
            description="Write your first posting, publish it, and applicants start arriving through the careers page."
            action={
              <LinkButton href={NEW_POSTING_ROUTE} leftSection={<IconPlus size={16} aria-hidden />}>
                New posting
              </LinkButton>
            }
          />
        }
        noResults={
          <EmptyState
            title="Nothing matches those filters"
            description="Clear them to see every posting that is not archived."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
      />
    </Stack>
  )
}
