import { Alert, Box, Button, Skeleton, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export interface CalendarStatesProps {
  /** Nothing to show yet: the first load. */
  isLoading: boolean
  /** Set when the month could not be loaded and there is nothing older to keep showing. */
  errorMessage: string | undefined
  onRetry: () => void
  /** A page change is in flight, so the month on screen is the previous one. */
  isStale: boolean
  children: ReactNode
}

/** Loading, failed, or the month itself — with the skeleton shaped like the grid it stands for. */
export function CalendarStates({
  isLoading,
  errorMessage,
  onRetry,
  isStale,
  children,
}: CalendarStatesProps) {
  if (errorMessage !== undefined) {
    return (
      <Alert color="red" variant="light" title="Could not load the calendar" role="alert">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{errorMessage}</Text>
          <Button size="sm" variant="light" color="red" onClick={onRetry}>
            Try again
          </Button>
        </Stack>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <Stack gap="xs" aria-busy="true">
        <Skeleton height={36} />
        {[0, 1, 2, 3, 4].map((week) => (
          <Skeleton key={week} height={116} />
        ))}
      </Stack>
    )
  }

  // A page change keeps the old month on screen, dimmed, until the new one lands.
  return <Box opacity={isStale ? 0.6 : 1}>{children}</Box>
}
