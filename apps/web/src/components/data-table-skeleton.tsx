import { Skeleton, Stack, VisuallyHidden } from '@mantine/core'

// Same column count and row height as the loaded table, so nothing shifts when data lands.
export function DataTableSkeleton({ label, rows }: { label: string; rows: number }) {
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
