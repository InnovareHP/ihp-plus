'use client'

import {
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/page-shell'
import { pageRangeOf } from '@/lib/pagination'
import { requestRoute } from '@/lib/routes'
import { useUrlQueryParam } from '@/lib/use-url-query-param'
import {
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_FILTERS,
  REQUEST_STATUS_LABELS,
  type RequestQuery,
  type RequestRow,
  type RequestStatusFilter,
} from '../schema'
import { useDecideRequest, useRequestQueue } from '../use-requests'
import { DecisionFields } from './decision-fields'
import { RequestAnswers } from './request-answers'

const submitted = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const PAGE_SIZE = 25

const STATUS_TAB_LABELS: Record<RequestStatusFilter, string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

function statusOf(value: string): RequestStatusFilter {
  return (REQUEST_STATUS_FILTERS as readonly string[]).includes(value)
    ? (value as RequestStatusFilter)
    : 'pending'
}

export function ApprovalsPanel() {
  const statusParam = useUrlQueryParam('status', 0)
  const searchParam = useUrlQueryParam('q')
  const pageParam = useUrlQueryParam('page', 0)

  const query: RequestQuery = {
    status: statusOf(statusParam.value || 'pending'),
    search: searchParam.value.trim(),
    teamIds: [],
    page: Number(pageParam.value) || 1,
    pageSize: PAGE_SIZE,
  }

  const queue = useRequestQueue(query)
  const decide = useDecideRequest(query)
  const [deciding, setDeciding] = useState<RequestRow | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const columns: DataTableColumn<RequestRow>[] = [
    {
      key: 'form',
      header: 'Request',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Link href={requestRoute(row.id)}>{row.formName}</Link>
          <Text size="xs" c="dimmed">
            {row.requesterName} · {submitted.format(new Date(row.createdAt))}
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
      key: 'status',
      header: 'Status',
      width: 130,
      render: (row) => (
        <Badge color={REQUEST_STATUS_COLORS[row.status]} variant="light">
          {REQUEST_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 260,
      align: 'right',
      render: (row) => (
        <Group gap="xs" justify="flex-end" wrap="nowrap">
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            aria-label={`${expanded === row.id ? 'Hide' : 'Show'} the answers on ${row.requesterName}'s ${row.formName} request`}
            aria-expanded={expanded === row.id}
            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
          >
            Answers
          </Button>
          {row.canDecide ? (
            <>
              <Button
                variant="subtle"
                size="compact-sm"
                aria-label={`Decide ${row.requesterName}'s ${row.formName} request`}
                onClick={() => setDeciding(row)}
              >
                Decide
              </Button>
            </>
          ) : null}
        </Group>
      ),
    },
  ]

  const openRow = queue.data?.rows.find((row) => row.id === expanded)
  const pageInfo = queue.data?.pageInfo

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <SearchField initial={searchParam.value} onSearch={searchParam.commit} />
      </Group>

      <Tabs
        value={query.status}
        onChange={(value) => {
          statusParam.commit(value ?? 'pending')
          pageParam.commit('')
        }}
      >
        <Tabs.List>
          {REQUEST_STATUS_FILTERS.map((value) => (
            <Tabs.Tab key={value} value={value}>
              {STATUS_TAB_LABELS[value]}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <DataTable
        label="Requests"
        columns={columns}
        rows={queue.data?.rows}
        rowKey={(row) => row.id}
        isPending={queue.isPending}
        isError={queue.isError}
        isFetching={queue.isFetching}
        error={queue.error}
        onRetry={() => queue.refetch()}
        minWidth={820}
        empty={
          <EmptyState
            title={query.search ? 'Nothing matches that search' : 'Nothing waiting on you'}
            description={
              query.search
                ? 'Clear the search to see the whole queue.'
                : 'Requests raised in the departments you approve for land here.'
            }
            action={
              query.search ? (
                <Button variant="default" onClick={() => searchParam.commit('')}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />

      {openRow ? (
        <Stack
          gap="xs"
          p="md"
          bd="1px solid var(--mantine-color-default-border)"
          style={{ borderRadius: 'var(--mantine-radius-md)' }}
        >
          <Text fw={600} size="sm">
            {openRow.formName} · {openRow.requesterName}
          </Text>
          <RequestAnswers fields={openRow.fields} values={openRow.values} />
        </Stack>
      ) : null}

      {pageInfo && pageInfo.pageCount > 1 ? (
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Text size="sm" c="dimmed">
            Showing {pageRangeOf(pageInfo).from}–{pageRangeOf(pageInfo).to} of {pageInfo.total}
          </Text>
          <Pagination
            value={pageInfo.page}
            total={pageInfo.pageCount}
            onChange={(page) => pageParam.commit(String(page))}
          />
        </Group>
      ) : null}

      <Modal
        opened={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        centered
        title={deciding ? `${deciding.formName} from ${deciding.requesterName}` : 'Decide request'}
      >
        {deciding ? (
          <Stack gap="md">
            <RequestAnswers fields={deciding.fields} values={deciding.values} />
            <DecisionFields
              label="request"
              isPending={decide.isPending}
              onCancel={() => setDeciding(null)}
              onDecide={(decision, note) => {
                decide.mutate({ submissionId: deciding.id, decision, note })
                setDeciding(null)
              }}
            />
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  )
}

function SearchField({
  initial,
  onSearch,
}: {
  initial: string
  onSearch: (value: string) => void
}) {
  const { register } = useForm<{ q: string }>({ defaultValues: { q: initial } })
  const field = register('q')

  return (
    <TextInput
      {...field}
      onChange={(event) => {
        void field.onChange(event)
        onSearch(event.currentTarget.value)
      }}
      type="search"
      label="Search requests"
      placeholder="Form or department"
      leftSection={<IconSearch size={16} aria-hidden />}
      w={{ base: '100%', sm: 300 }}
    />
  )
}
