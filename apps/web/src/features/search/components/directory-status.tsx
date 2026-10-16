'use client'

import { Box, Button, Group, Skeleton, Stack, Text } from '@mantine/core'

export interface DirectoryStatusProps {
  state: 'loading' | 'error'
  onRetry: () => void
}

/** Stands in for the people and clients groups while they load or after they fail. */
export function DirectoryStatus({ state, onRetry }: DirectoryStatusProps) {
  if (state === 'loading') {
    return (
      <Stack gap={0} aria-busy="true" aria-label="Loading people and clients">
        {/* Same height as a result row, so nothing jumps when the names arrive. */}
        {[0, 1].map((row) => (
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
    <Group justify="space-between" wrap="nowrap" gap="sm" mih={52} px="sm">
      <Text size="sm" c="dimmed" role="alert">
        Couldn’t load people and clients — check your connection and try again. Pages still work.
      </Text>
      <Button size="xs" variant="default" onClick={onRetry}>
        Try again
      </Button>
    </Group>
  )
}
