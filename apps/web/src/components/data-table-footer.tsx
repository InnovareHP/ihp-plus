'use client'

import { Box, Group, Pagination, Select, Text } from '@mantine/core'
import { PAGE_SIZES, pageRangeOf, type PageInfo } from '@/lib/pagination'

const SIZE_OPTIONS = PAGE_SIZES.map((size) => ({ value: String(size), label: `${size} per page` }))

// Outside the scroll container: the row count and the pager must not scroll away sideways.
export function DataTableFooter({
  label,
  pageInfo,
  onPageChange,
  onPageSizeChange,
}: {
  label: string
  pageInfo: PageInfo
  onPageChange: ((page: number) => void) | undefined
  onPageSizeChange?: ((pageSize: number) => void) | undefined
}) {
  const range = pageRangeOf(pageInfo)

  return (
    <Group justify="space-between" wrap="wrap" gap="sm">
      <Group gap="sm" wrap="wrap">
        <Text size="sm" c="dimmed" aria-live="polite">
          Showing {range.from}–{range.to} of {pageInfo.total}
        </Text>
        {/* Offered once there is a second page to reach; below that it is a dead control. */}
        {onPageSizeChange && pageInfo.total > PAGE_SIZES[0] ? (
          <Select
            size="xs"
            w={140}
            aria-label={`Rows per page of ${label.toLowerCase()}`}
            data={SIZE_OPTIONS}
            value={String(pageInfo.pageSize)}
            onChange={(value) => value && onPageSizeChange(Number(value))}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        ) : null}
      </Group>
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
