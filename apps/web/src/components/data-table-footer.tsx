'use client'

import { Box, Group, Pagination, Text } from '@mantine/core'
import { pageRangeOf, type PageInfo } from '@/lib/pagination'

// Outside the scroll container: the row count and the pager must not scroll away sideways.
export function DataTableFooter({
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
