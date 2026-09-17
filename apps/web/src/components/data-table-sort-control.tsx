'use client'

import { Group, UnstyledButton } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { DataTableColumn, DataTableSort, SortDirection } from './data-table'

export function SortControl<TRow>({
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
