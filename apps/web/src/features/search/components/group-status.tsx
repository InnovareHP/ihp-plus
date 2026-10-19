'use client'

import { Box, Button, Group, Skeleton, Stack, Text } from '@mantine/core'

export interface GroupStatusProps {
  /** What is being fetched, in words: "people and clients", "tasks". */
  subject: string
  state: 'loading' | 'error'
  onRetry: () => void
  rows?: number
}

/** Stands in for a result group while it loads or after it fails, so the others stay usable. */
export function GroupStatus({ subject, state, onRetry, rows = 2 }: GroupStatusProps) {
  if (state === 'loading') {
    return (
      <Stack gap={0} aria-busy="true" aria-label={`Loading ${subject}`}>
        {/* Same height as a result row, so nothing jumps when the results arrive. */}
        {Array.from({ length: rows }, (_, row) => (
          <Group key={row} wrap="nowrap" gap="sm" mih={52} px="sm">
            <Skeleton circle height={36} />
            <Box flex={1}>
              <Skeleton height={12} width="40%" mb={8} />
              <Skeleton height={10} width="25%" />
            </Box>
          </Group>
        ))}
      </Stack>
    )
  }

  return (
    <Group justify="space-between" gap="sm" mih={52} px="sm">
      <Text size="sm" c="dimmed" role="alert">
        Couldn’t load {subject} — check your connection and try again. Other results still work.
      </Text>
      <Button
        size="xs"
        variant="default"
        onClick={onRetry}
        aria-label={`Try again to load ${subject}`}
      >
        Try again
      </Button>
    </Group>
  )
}
