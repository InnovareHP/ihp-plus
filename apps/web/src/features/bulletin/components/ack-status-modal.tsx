'use client'

import { Alert, Button, Modal, Skeleton, Stack, Tabs, Text } from '@mantine/core'
import { describeMoment } from '@/lib/relative-time'
import { useAcknowledgements } from '../hooks/use-acknowledgements'
import type { AcknowledgementPersonRow } from '../schema'
import { AckPersonList } from './ack-person-list'

export interface AckStatusModalProps {
  postId: string
  opened: boolean
  onClose: () => void
}

export function AckStatusModal({ postId, opened, onClose }: AckStatusModalProps) {
  const list = useAcknowledgements(postId, opened)

  return (
    <Modal opened={opened} onClose={onClose} title="Who has confirmed" centered>
      {list.isPending ? (
        <Stack gap="xs" aria-busy="true" aria-label="Loading who has confirmed">
          <Skeleton height={36} />
          <Skeleton height={28} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </Stack>
      ) : list.isError ? (
        <Alert color="red" variant="light" title="Could not load the list" role="alert">
          <Button variant="default" mt="sm" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </Alert>
      ) : (
        <Tabs defaultValue="waiting">
          <Tabs.List grow>
            <Tabs.Tab value="waiting">Waiting ({list.data.waiting.length})</Tabs.Tab>
            <Tabs.Tab value="confirmed">Confirmed ({list.data.confirmed.length})</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="waiting" pt="sm">
            <AckPersonList
              people={list.data.waiting}
              empty="Everyone has confirmed."
              detail={() => undefined}
            />
          </Tabs.Panel>
          <Tabs.Panel value="confirmed" pt="sm">
            <AckPersonList
              people={list.data.confirmed}
              empty="Nobody has confirmed yet."
              detail={(person: AcknowledgementPersonRow) =>
                person.acknowledgedAt ? describeMoment(person.acknowledgedAt) : undefined
              }
            />
          </Tabs.Panel>
        </Tabs>
      )}
      <Text size="xs" c="dimmed" mt="md">
        Counts everyone in the company except whoever wrote the post.
      </Text>
    </Modal>
  )
}
