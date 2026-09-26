'use client'

import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import type { BillingStatementRow } from '../schema'
import { formatStatementDate, formatUsd } from '../utils/billing-statement'

export interface BillingStatementsTableProps {
  title: string
  statements: readonly BillingStatementRow[] | undefined
  isPending: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  onPrint: (statement: BillingStatementRow) => void
  /** Left out where the viewer is not the statement's author, such as an admin's list. */
  onDelete?: (statement: BillingStatementRow) => void
  /** An admin's list covers everyone, so it says whose each statement is. */
  showContractor?: boolean
  emptyHint: string
}

/** Saved billing statements, each one printable again exactly as it was issued. */
export function BillingStatementsTable({
  title,
  statements,
  isPending,
  isError,
  isFetching,
  onRetry,
  onPrint,
  onDelete,
  showContractor = false,
  emptyHint,
}: BillingStatementsTableProps) {
  const columns: DataTableColumn<BillingStatementRow>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.invoiceNumber}
          </Text>
          <Text size="xs" c="dimmed">
            {formatStatementDate(row.invoiceDate)}
          </Text>
        </Stack>
      ),
    },
    ...(showContractor
      ? [
          {
            key: 'contractor',
            header: 'Contractor',
            render: (row: BillingStatementRow) => row.contractorName,
          },
        ]
      : []),
    {
      key: 'period',
      header: 'Billing period',
      render: (row) =>
        `${formatStatementDate(row.periodStart)} – ${formatStatementDate(row.periodEnd)}`,
    },
    {
      key: 'days',
      header: 'Days',
      align: 'right',
      render: (row) => row.daysWorked,
    },
    {
      key: 'total',
      header: 'Total due',
      align: 'right',
      render: (row) => (
        <Text size="sm" fw={600}>
          {formatUsd(row.totalCents)}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        // A row still being saved has no server id to act on yet.
        const saving = row.id.startsWith('pending-')
        return (
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={() => onPrint(row)}
              aria-label={`Print ${row.invoiceNumber}`}
            >
              Print
            </Button>
            {onDelete ? (
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                disabled={saving}
                onClick={() => onDelete(row)}
                aria-label={`Delete ${row.invoiceNumber}`}
              >
                Delete
              </Button>
            ) : null}
          </Group>
        )
      },
    },
  ]

  return (
    <Stack gap="xs" component="section" aria-label={title}>
      <Title order={3} size="h6">
        {title}
      </Title>
      <DataTable
        label={title}
        columns={columns}
        rows={statements}
        rowKey={(row) => row.id}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        onRetry={onRetry}
        errorTitle="Could not load the billing statements"
        minWidth={showContractor ? 720 : 600}
        empty={<EmptyState title="No billing statements yet" description={emptyHint} />}
      />
    </Stack>
  )
}
