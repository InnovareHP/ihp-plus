'use client'

import {
  Alert,
  Box,
  Button,
  Group,
  Pagination,
  Skeleton,
  Stack,
  Table,
  Text,
  UnstyledButton,
  VisuallyHidden,
} from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { pageRangeOf, type PageInfo } from '@/lib/pagination'

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
  /** Server-side paging: pass the page the server reported to get the footer and controls. */
  pageInfo?: PageInfo
  onPageChange?: (page: number) => void
  minWidth?: number
  stickyHeader?: boolean
  skeletonRows?: number
  sort?: DataTableSort
  onSortChange?: (sort: DataTableSort) => void
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const

export function DataTable<TRow>({
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
  minWidth = 720,
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
        <DataTableFooter label={label} pageInfo={pageInfo} onPageChange={onPageChange} />
      ) : null}
    </Stack>
  )
}

// Outside the scroll container: the row count and the pager must not scroll away sideways.
function DataTableFooter({
  label,
  pageInfo,
  onPageChange,
}: {
  label: string
  pageInfo: PageInfo
  onPageChange: ((page: number) => void) | undefined
}) {
  const range = pageRangeOf(pageInfo)

  return (
    <Group justify="space-between" wrap="wrap" gap="sm">
      <Text size="sm" c="dimmed" aria-live="polite">
        Showing {range.from}–{range.to} of {pageInfo.total}
      </Text>
      {pageInfo.pageCount > 1 && onPageChange ? (
        <Box component="nav" aria-label={`${label} pages`}>
          <Pagination
            total={pageInfo.pageCount}
            value={pageInfo.page}
            onChange={onPageChange}
            size="sm"
            getItemProps={(page) => ({ 'aria-label': `Page ${page}` })}
            getControlProps={(control) => ({ 'aria-label': `${control} page` })}
          />
        </Box>
      ) : null}
    </Group>
  )
}

function SortControl<TRow>({
  column,
  sort,
  onSortChange,
}: {
  column: DataTableColumn<TRow>
  sort: DataTableSort | undefined
  onSortChange: (sort: DataTableSort) => void
}) {
  const Icon = !sort ? IconArrowsSort : sort.direction === 'asc' ? IconArrowUp : IconArrowDown
  const next: SortDirection = sort?.direction === 'asc' ? 'desc' : 'asc'

  return (
    <UnstyledButton
      fz="sm"
      fw={600}
      onClick={() => onSortChange({ key: column.key, direction: next })}
      aria-label={`Sort by ${textOf(column.header)}, ${next === 'asc' ? 'ascending' : 'descending'}`}
    >
      <Group gap={4} wrap="nowrap">
        {column.header}
        <Icon size={14} aria-hidden />
      </Group>
    </UnstyledButton>
  )
}

// A sortable column's header is expected to be a string; a rich node has no spoken text.
function textOf(header: ReactNode) {
  return typeof header === 'string' ? header : 'this column'
}

// Same column count and row height as the loaded table, so nothing shifts when data lands.
function DataTableSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <Stack gap="xs" aria-busy="true">
      <VisuallyHidden>Loading {label.toLowerCase()}…</VisuallyHidden>
      <Skeleton height={38} />
      {Array.from({ length: rows }, (_, row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
