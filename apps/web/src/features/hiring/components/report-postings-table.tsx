'use client'

import { Text } from '@mantine/core'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { LinkAnchor } from '@/components/link-anchor'
import { postingRoute } from '@/lib/routes'
import type { ReportPostingRow } from '../schema'
import { formatDays } from '../utils/report'

const number = new Intl.NumberFormat('en-US')

const COLUMNS: readonly DataTableColumn<ReportPostingRow>[] = [
  {
    key: 'title',
    header: 'Posting',
    rowHeader: true,
    render: (row) => (
      <LinkAnchor href={postingRoute(row.id)} size="sm" fw={500}>
        {row.title}
      </LinkAnchor>
    ),
  },
  {
    key: 'applications',
    header: 'Applied',
    align: 'right',
    render: (row) => number.format(row.applications),
  },
  {
    key: 'active',
    header: 'In progress',
    align: 'right',
    render: (row) => number.format(row.active),
  },
  { key: 'hired', header: 'Hired', align: 'right', render: (row) => number.format(row.hired) },
  {
    key: 'rejected',
    header: 'Rejected',
    align: 'right',
    render: (row) => number.format(row.rejected),
  },
  {
    key: 'withdrawn',
    header: 'Withdrew',
    align: 'right',
    render: (row) => number.format(row.withdrawn),
  },
  {
    key: 'median',
    header: 'Median time to hire',
    align: 'right',
    render: (row) => (
      <Text size="sm" span c={row.medianDaysToHire === undefined ? 'dimmed' : undefined}>
        {formatDays(row.medianDaysToHire)}
      </Text>
    ),
  },
]

export interface ReportPostingsTableProps {
  rows: readonly ReportPostingRow[]
}

export function ReportPostingsTable({ rows }: ReportPostingsTableProps) {
  return (
    <DataTable
      label="Outcomes by posting"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      isPending={false}
      empty="No postings had applicants in this period."
    />
  )
}
