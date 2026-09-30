'use client'

import { Menu, Stack, Text, Title } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { RowActionsMenu } from '@/components/row-actions-menu'
import type { BillingStatementRow } from '../schema'
import { formatStatementDate, formatUsd } from '../utils/billing-statement'
import type { StatementOutput } from '../utils/statement-output'

export interface BillingStatementsTableProps {
  title: string
  statements: readonly BillingStatementRow[] | undefined
  isPending: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  onOutput: (statement: BillingStatementRow, output: StatementOutput) => void
  /** Left out where the viewer is not the statement's author, such as an admin's list. */
  onDelete?: (statement: BillingStatementRow) => void
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
  onOutput,
  onDelete,
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
    {
      key: 'period',
      header: 'Billing period',
      render: (row) =>
        `${formatStatementDate(row.periodStart)} – ${formatStatementDate(row.periodEnd)}`,
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'right',
      render: (row) => row.hoursWorked.toFixed(2),
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
      width: 90,
      render: (row) => (
        <RowActionsMenu name={row.invoiceNumber}>
          <Menu.Item onClick={() => onOutput(row, 'print')}>Print</Menu.Item>
          <Menu.Item onClick={() => onOutput(row, 'pdf')}>Download PDF</Menu.Item>
          <Menu.Item onClick={() => onOutput(row, 'email')}>Create email</Menu.Item>
          {onDelete ? (
            <Menu.Item
              color="red"
              // A row still being saved has no server id to act on yet.
              disabled={row.id.startsWith('pending-')}
              onClick={() => onDelete(row)}
            >
              Delete
            </Menu.Item>
          ) : null}
        </RowActionsMenu>
      ),
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
        minWidth={600}
        empty={<EmptyState title="No billing statements yet" description={emptyHint} />}
      />
    </Stack>
  )
}
