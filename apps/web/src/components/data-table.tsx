'use client'

import { Alert, Button, Stack, Table, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import type { PageInfo } from '@/lib/pagination'
import { useClientPagination } from '@/lib/use-client-pagination'
import { DataTableFooter } from './data-table-footer'
import { DataTableSkeleton } from './data-table-skeleton'
import { SortControl } from './data-table-sort-control'

export type SortDirection = 'asc' | 'desc'

export interface DataTableSort {
  key: string
  direction: SortDirection
}

export interface DataTableColumn<TRow> {
  key: string
  header: ReactNode
  render: (row: TRow) => ReactNode
  // Exactly one column sets this; its cell is the row's <th scope="row">.
  rowHeader?: boolean
  sortable?: boolean
  width?: number
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<TRow> {
  /** Accessible name of the table — what the rows are, e.g. "Members". */
  label: string
  columns: readonly DataTableColumn<TRow>[]
  rows: readonly TRow[] | undefined
  rowKey: (row: TRow) => string
  isPending: boolean
  isError?: boolean
  isFetching?: boolean
  error?: { message: string } | null
  errorTitle?: string
  onRetry?: () => void
  /** Shown instead of a bare table: why it is empty plus the control that fills it. */
  empty: ReactNode
  /** Shown instead of `empty` when a filter is what emptied the list — keeps a way back. */
  noResults?: ReactNode
  isFiltered?: boolean
  /** Paging the caller owns; without onPageChange the table pages its rows itself, in the URL. */
  pageInfo?: PageInfo
  onPageChange?: (page: number) => void
  /** Passing it puts the rows-per-page control in the footer. */
  onPageSizeChange?: (pageSize: number) => void
  minWidth?: number
  /** 'comfortable' gives a document library room to breathe; 'compact' is the dense default. */
  density?: 'compact' | 'comfortable'
  stickyHeader?: boolean
  skeletonRows?: number
  sort?: DataTableSort
  onSortChange?: (sort: DataTableSort) => void
  /** URL param for the built-in paging; defaults to one derived from `label`. */
  pageKey?: string
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const

// Two self-paged tables on one screen must not share a ?page= param, so each gets its label's.
function pageKeyOf(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'table'}-page`
}

export function DataTable<TRow>(props: DataTableProps<TRow>) {
  // A caller that pages (on the server or itself) passes onPageChange; every other list is paged here.
  return props.onPageChange ? <PagedTable {...props} /> : <SelfPagedTable {...props} />
}

function SelfPagedTable<TRow>({ rows, pageKey, label, ...props }: DataTableProps<TRow>) {
  const paged = useClientPagination(rows, { key: pageKey ?? pageKeyOf(label) })

  return (
    <PagedTable
      {...props}
      label={label}
      rows={paged.rows}
      pageInfo={paged.pageInfo}
      onPageChange={paged.onPageChange}
      onPageSizeChange={paged.onPageSizeChange}
    />
  )
}

function PagedTable<TRow>({
  label,
  columns,
  rows,
  rowKey,
  isPending,
  isError = false,
  isFetching = false,
  error,
  errorTitle = `Could not load ${label.toLowerCase()}`,
  onRetry,
  empty,
  noResults,
  isFiltered = false,
  pageInfo,
  onPageChange,
  onPageSizeChange,
  minWidth = 720,
  density = 'compact',
  stickyHeader = true,
  skeletonRows = 3,
  sort,
  onSortChange,
}: DataTableProps<TRow>) {
  if (isPending) {
    return <DataTableSkeleton label={label} rows={skeletonRows} />
  }

  if (isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title={errorTitle}>
          <Text size="sm">{error?.message ?? 'Something went wrong on our side.'}</Text>
        </Alert>
        {onRetry ? (
          <Button onClick={onRetry} w="fit-content">
            Try again
          </Button>
        ) : null}
      </Stack>
    )
  }

  if (!rows || rows.length === 0) {
    // "No match for this filter" is a different screen from "nothing here yet".
    const state = isFiltered && noResults ? noResults : empty
    return typeof state === 'string' ? <Text c="dimmed">{state}</Text> : <>{state}</>
  }

  return (
    <Stack gap="md">
      <Table.ScrollContainer minWidth={minWidth}>
        {/* A background refetch dims the table; only isPending may replace it with the skeleton. */}
        <Table
          striped
          verticalSpacing={density === 'comfortable' ? 'md' : 'xs'}
          highlightOnHover
          // Ruled rather than floating: a border around the table and between its columns is
          // what makes a dense grid scannable down a column as well as across a row.
          withTableBorder
          withColumnBorders
          stickyHeader={stickyHeader}
          aria-label={label}
          aria-busy={isFetching || undefined}
          opacity={isFetching ? 0.6 : undefined}
        >
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th
                  key={column.key}
                  scope="col"
                  w={column.width}
                  ta={column.align}
                  aria-sort={
                    column.sortable
                      ? sort?.key === column.key
                        ? ARIA_SORT[sort.direction]
                        : 'none'
                      : undefined
                  }
                >
                  {column.sortable && onSortChange ? (
                    <SortControl
                      column={column}
                      sort={sort?.key === column.key ? sort : undefined}
                      onSortChange={onSortChange}
                    />
                  ) : (
                    column.header
                  )}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={rowKey(row)}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <Table.Th key={column.key} scope="row" fw={400} ta={column.align}>
                      {column.render(row)}
                    </Table.Th>
                  ) : (
                    <Table.Td key={column.key} ta={column.align}>
                      {column.render(row)}
                    </Table.Td>
                  ),
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {pageInfo ? (
        <DataTableFooter
          label={label}
          pageInfo={pageInfo}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </Stack>
  )
}
