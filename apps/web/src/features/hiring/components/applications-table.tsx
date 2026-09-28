'use client'

import { Anchor, Badge, Button, Stack, Text } from '@mantine/core'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { relativeTo } from '@/lib/relative-time'
import { applicationRoute, postingRoute } from '@/lib/routes'
import type { UrlQuery } from '@/lib/url-query'
import { useApplicationDecisions } from '../hooks/use-application-decisions'
import { useApplications } from '../hooks/use-applications'
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_FILTER_OPTIONS,
  APPLICATION_STATUS_LABELS,
  isFilteredApplicationQuery,
  type ApplicationQuery,
  type ApplicationSummary,
  type Stage,
} from '../schema'
import { ApplicationActionsMenu } from './application-actions-menu'
import { DecisionModals } from './decision-modals'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export interface ApplicationsTableProps extends UrlQuery<ApplicationQuery> {
  rejectionMessage: string
  /** Set on a posting's own page: the list is scoped to it and can move people between stages. */
  posting?: { id: string; stages: readonly Stage[] }
  /** Offered as a filter on the all-postings page. */
  postingOptions?: readonly { value: string; label: string }[]
}

export function ApplicationsTable({
  query,
  setQuery,
  clearFilters,
  rejectionMessage,
  posting,
  postingOptions = [],
}: ApplicationsTableProps) {
  const listQuery: ApplicationQuery = posting ? { ...query, postingId: posting.id } : query
  const applications = useApplications(listQuery)
  const decisions = useApplicationDecisions()

  const filters: FilterControl[] = [
    { kind: 'select', key: 'status', label: 'Status', options: APPLICATION_STATUS_FILTER_OPTIONS },
    posting
      ? {
          kind: 'select',
          key: 'stageId',
          label: 'Stage',
          options: posting.stages.map((stage) => ({ value: stage.id, label: stage.name })),
        }
      : { kind: 'select', key: 'postingId', label: 'Job posting', options: postingOptions },
  ]

  const columns: DataTableColumn<ApplicationSummary>[] = [
    {
      key: 'name',
      header: 'Applicant',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Anchor component={Link} href={applicationRoute(row.id)} size="sm" fw={600}>
            {row.fullName}
          </Anchor>
          <Text size="xs" c="dimmed">
            {row.email}
          </Text>
        </Stack>
      ),
    },
    ...(posting
      ? []
      : [
          {
            key: 'posting',
            header: 'Job',
            render: (row: ApplicationSummary) => (
              <Anchor component={Link} href={postingRoute(row.postingId)} size="sm">
                {row.postingTitle}
              </Anchor>
            ),
          },
        ]),
    {
      key: 'stage',
      header: 'Where they are',
      width: 200,
      render: (row) =>
        row.status === 'active' ? (
          <Text size="sm">{row.stageName}</Text>
        ) : (
          <Badge color={APPLICATION_STATUS_COLORS[row.status]} variant="light">
            {APPLICATION_STATUS_LABELS[row.status]}
          </Badge>
        ),
    },
    {
      key: 'applied',
      header: 'Applied',
      width: 170,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm">{dateOnly.format(new Date(row.createdAt))}</Text>
          <Text size="xs" c="dimmed">
            {relativeTo(row.createdAt)}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) => (
        <ApplicationActionsMenu
          application={row}
          stages={posting?.stages}
          onMove={(stage) => decisions.requestMove(row, stage)}
          onReject={() => decisions.requestReject(row)}
          onReopen={() => decisions.reopen(row)}
        />
      ),
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="applicants"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
      />
      <DataTable
        label="Applicants"
        columns={columns}
        rows={applications.data?.rows}
        rowKey={(row) => row.id}
        pageInfo={applications.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        onPageSizeChange={(pageSize) => setQuery({ pageSize, page: 1 })}
        isPending={applications.isPending}
        isError={applications.isError}
        isFetching={applications.isPlaceholderData}
        error={applications.error}
        onRetry={() => applications.refetch()}
        isFiltered={isFilteredApplicationQuery(query)}
        minWidth={posting ? 640 : 820}
        empty={
          <EmptyState
            title="Nobody in progress"
            description="New applications from the careers page show up here as soon as they are sent."
          />
        }
        noResults={
          <EmptyState
            title="Nobody matches those filters"
            description="Clear them to see everyone still in progress."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
      />
      <DecisionModals decisions={decisions} rejectionMessage={rejectionMessage} />
    </Stack>
  )
}
