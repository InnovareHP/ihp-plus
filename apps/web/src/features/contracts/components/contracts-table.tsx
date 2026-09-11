'use client'

import { Badge, Button, Group, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/page-shell'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import {
  BILLING_CYCLE_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  DEFAULT_CONTRACT_QUERY,
  contractQuerySchema,
  formatCents,
  isFilteredContractQuery,
  type ContractRow,
} from '../schema'
import { useContracts } from '../use-contracts'
import { ContractFormModal } from './contract-form-modal'

const created = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

const parseContractQuery = searchParamsParser(contractQuerySchema)

const FILTERS: readonly FilterControl[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    options: CONTRACT_STATUSES.map((status) => ({
      value: status,
      label: CONTRACT_STATUS_LABELS[status],
    })),
  },
]

export function ContractsTable({ canManage }: { canManage: boolean }) {
  const { query, setQuery, clearFilters } = useUrlQuery(parseContractQuery, DEFAULT_CONTRACT_QUERY)
  const contracts = useContracts(query)
  const [createOpened, createModal] = useDisclosure(false)

  const columns: DataTableColumn<ContractRow>[] = [
    {
      key: 'reference',
      header: 'Contract',
      rowHeader: true,
      sortable: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.title}
          </Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {row.reference}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (row) => <Text size="sm">{row.clientName}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      sortable: true,
      render: (row) => (
        <Badge color={CONTRACT_STATUS_COLORS[row.status]} variant="light">
          {CONTRACT_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'subtotal',
      header: 'Value',
      width: 160,
      align: 'right',
      sortable: true,
      render: (row) => (
        <Stack gap={0} align="flex-end">
          <Text size="sm" fw={500}>
            {formatCents(row.subtotalCents)}
          </Text>
          <Text size="xs" c="dimmed">
            {BILLING_CYCLE_LABELS[row.billingCycle]}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'billing',
      header: 'Billing',
      width: 120,
      render: (row) =>
        row.isBilled ? (
          <Badge variant="light" color="green">
            In Stripe
          </Badge>
        ) : (
          // Stripe is not wired yet, so this says what is true rather than implying a failure.
          <Text size="sm" c="dimmed">
            Not billed
          </Text>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 140,
      sortable: true,
      render: (row) => (
        <Text size="sm" c="dimmed">
          {created.format(new Date(row.createdAt))}
        </Text>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <TableToolbar
          label="contracts"
          query={query}
          setQuery={setQuery}
          clearFilters={clearFilters}
          filters={FILTERS}
        />
        {canManage ? (
          <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={createModal.open}>
            New contract
          </Button>
        ) : null}
      </Group>

      <DataTable
        label="Contracts"
        columns={columns}
        rows={contracts.data?.rows}
        rowKey={(row) => row.id}
        isPending={contracts.isPending}
        isError={contracts.isError}
        isFetching={contracts.isFetching}
        error={contracts.error}
        onRetry={() => contracts.refetch()}
        minWidth={880}
        pageInfo={contracts.data?.pageInfo}
        onPageChange={(page) => setQuery({ page })}
        isFiltered={isFilteredContractQuery(query)}
        sort={{ key: query.sortBy, direction: query.sortDirection }}
        onSortChange={(sort) =>
          setQuery({
            sortBy: sort.key as typeof query.sortBy,
            sortDirection: sort.direction,
          })
        }
        noResults={
          <EmptyState
            title="No contract matches those filters"
            description="Clear them to see everything this company has agreed."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="No contracts yet"
            description="Price a client off the rate card to agree the first one."
            action={
              canManage ? <Button onClick={createModal.open}>New contract</Button> : undefined
            }
          />
        }
      />

      {canManage ? <ContractFormModal opened={createOpened} onClose={createModal.close} /> : null}
    </Stack>
  )
}
