'use client'

import { Alert, Button, Divider, Skeleton, Stack, Text } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import type { ClientAccessRow as AccessRow } from '../schema'
import { ClientAccessRow } from './client-access-row'

export interface ClientAccessListProps {
  rows: readonly AccessRow[]
  isPending: boolean
  isRevoking: boolean
  error: Error | null
  onRetry: () => void
  onRevoke: (row: AccessRow) => void
}

export function ClientAccessList({
  rows,
  isPending,
  isRevoking,
  error,
  onRetry,
  onRevoke,
}: ClientAccessListProps) {
  if (isPending) {
    return (
      <Stack gap="sm" aria-busy="true" aria-label="Loading who can open this folder">
        <Skeleton height={38} radius="sm" />
        <Skeleton height={38} radius="sm" />
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert role="alert" color="red" variant="light" title="Could not load who has access">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{error.message}</Text>
          <Button size="compact-sm" variant="light" onClick={onRetry}>
            Try again
          </Button>
        </Stack>
      </Alert>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nobody outside the company can open this folder"
        description="Share it with a client contact and everything your team files for them appears there."
      />
    )
  }

  return (
    <Stack gap="xs" component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {rows.map((row, index) => (
        <li key={row.id}>
          {index > 0 ? <Divider mb="xs" /> : null}
          <ClientAccessRow row={row} isPending={isRevoking} onRevoke={onRevoke} />
        </li>
      ))}
    </Stack>
  )
}
