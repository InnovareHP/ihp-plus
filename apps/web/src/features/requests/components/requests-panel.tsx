'use client'

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Tabs,
  Text,
} from '@mantine/core'
import { IconFilePlus } from '@tabler/icons-react'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { LinkButton } from '@/components/link-button'
import { EmptyState, PageSection } from '@/components/page-shell'
import { newRequestRoute, requestRoute } from '@/lib/routes'
import { useUrlQueryParam } from '@/lib/use-url-query-param'
import {
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_FILTERS,
  REQUEST_STATUS_LABELS,
  type FormRow,
  type RequestRow,
  type RequestStatusFilter,
} from '../schema'
import { useAvailableForms, useMyRequests, useWithdrawRequest } from '../use-requests'

const submitted = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

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
    : 'all'
}

export function RequestsPanel({ hasDepartment }: { hasDepartment: boolean }) {
  const statusParam = useUrlQueryParam('status', 0)
  const status = statusOf(statusParam.value)

  return (
    <>
      <PageSection
        title="Start a request"
        description="Only the forms your department is offered appear here."
      >
        <FormCatalogue hasDepartment={hasDepartment} />
      </PageSection>

      <PageSection
        title="Your requests"
        description="Everything you have sent, and where it got to."
      >
        <Stack gap="md">
          <Tabs value={status} onChange={(value) => statusParam.commit(value ?? 'all')}>
            <Tabs.List>
              {REQUEST_STATUS_FILTERS.map((value) => (
                <Tabs.Tab key={value} value={value}>
                  {STATUS_TAB_LABELS[value]}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          <MyRequestsTable status={status} />
        </Stack>
      </PageSection>
    </>
  )
}

function FormCatalogue({ hasDepartment }: { hasDepartment: boolean }) {
  const forms = useAvailableForms()

  if (!hasDepartment) {
    return (
      <Alert color="yellow" variant="light" title="You have no department yet">
        <Text size="sm">
          Request forms are offered per department. Ask People &amp; Culture to place you in one.
        </Text>
      </Alert>
    )
  }

  if (forms.isPending) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" aria-busy="true">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={132} radius="md" />
        ))}
      </SimpleGrid>
    )
  }

  if (forms.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load the forms">
          <Text size="sm">{forms.error.message}</Text>
        </Alert>
        <Button onClick={() => forms.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  if (forms.data.length === 0) {
    return (
      <EmptyState
        title="No forms for your department yet"
        description="When an admin publishes one to your department it shows up here."
      />
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {forms.data.map((form) => (
        <FormCard key={form.id} form={form} />
      ))}
    </SimpleGrid>
  )
}

function FormCard({ form }: { form: FormRow }) {
  return (
    <Card padding="lg" component="article">
      <Stack gap="xs" h="100%" justify="space-between">
        <Stack gap={4}>
          <Text fw={600}>{form.name}</Text>
          <Text size="sm" c="dimmed" lineClamp={3}>
            {form.description || `${form.fields.length} questions.`}
          </Text>
        </Stack>
        <Group>
          <LinkButton
            href={newRequestRoute(form.id)}
            size="sm"
            leftSection={<IconFilePlus size={16} aria-hidden />}
          >
            Start
          </LinkButton>
        </Group>
      </Stack>
    </Card>
  )
}

function MyRequestsTable({ status }: { status: RequestStatusFilter }) {
  const requests = useMyRequests(status)
  const withdraw = useWithdrawRequest(status)

  const columns: DataTableColumn<RequestRow>[] = [
    {
      key: 'form',
      header: 'Request',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Link href={requestRoute(row.id)}>{row.formName}</Link>
          <Text size="xs" c="dimmed">
            {submitted.format(new Date(row.createdAt))}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      render: (row) => (
        <Badge color={REQUEST_STATUS_COLORS[row.status]} variant="light">
          {REQUEST_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'decision',
      header: 'Decision',
      render: (row) => (
        <Text size="sm" c="dimmed" lineClamp={2}>
          {row.decisionNote || (row.decidedBy ? `Decided by ${row.decidedBy}` : '—')}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 130,
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            aria-label={`Withdraw your ${row.formName} request`}
            onClick={() => withdraw.mutate({ submissionId: row.id })}
          >
            Withdraw
          </Button>
        ) : null,
    },
  ]

  return (
    <DataTable
      label="Your requests"
      columns={columns}
      rows={requests.data}
      rowKey={(row) => row.id}
      isPending={requests.isPending}
      isError={requests.isError}
      isFetching={requests.isFetching}
      error={requests.error}
      onRetry={() => requests.refetch()}
      minWidth={680}
      empty={
        <EmptyState
          title={
            status === 'all' ? 'You have not raised a request yet' : 'Nothing with that status'
          }
          description={
            status === 'all'
              ? 'Pick a form above and your request appears here with its progress.'
              : 'Switch tabs to see your other requests.'
          }
        />
      }
    />
  )
}
