'use client'

import { Group, Pagination, Text } from '@mantine/core'
import { pageRangeOf } from '@/lib/pagination'

export function DirectoryFooter({
  pageInfo,
  onPageChange,
}: {
  pageInfo: { page: number; pageSize: number; total: number; pageCount: number }
  onPageChange: (page: number) => void
}) {
  const range = pageRangeOf({ ...pageInfo, hasPrevious: false, hasNext: false })

  return (
    <Group justify="space-between" wrap="wrap" gap="sm">
      <Text size="sm" c="dimmed" aria-live="polite">
        Showing {range.from}–{range.to} of {pageInfo.total}
      </Text>
      {pageInfo.pageCount > 1 ? (
        <Pagination
          total={pageInfo.pageCount}
          value={pageInfo.page}
          onChange={onPageChange}
          size="sm"
          getItemProps={(page) => ({ 'aria-label': `Page ${page}` })}
        />
      ) : null}
    </Group>
  )
}
