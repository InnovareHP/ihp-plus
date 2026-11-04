'use client'

import {
  AspectRatio,
  Box,
  Center,
  Image,
  Paper,
  Skeleton,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { track } from '@/lib/analytics'
import { websiteEvents } from '../events'
import type { SnapshotState } from '../utils/snapshot-state'
import { SnapshotModal } from './snapshot-modal'

// The capture's own 16:10 viewport, so the box is the picture's size before the picture arrives.
const RATIO = 16 / 10
const MAX_WIDTH = 240

export interface SnapshotThumbProps {
  state: Exclude<SnapshotState, 'none'>
  websiteName: string
  roundLabel: string
  thumbSrc: string
  fullSrc: string
  /** Time of day the picture was taken, already formatted for the company's zone. */
  takenAt: string
  /** The lead can recheck, which also takes a new picture. */
  canRetry: boolean
}

export function SnapshotThumb({
  state,
  websiteName,
  roundLabel,
  thumbSrc,
  fullSrc,
  takenAt,
  canRetry,
}: SnapshotThumbProps) {
  const [opened, { open, close }] = useDisclosure(false)
  const subject = `${websiteName} at ${roundLabel.toLowerCase()}`

  if (state === 'pending') {
    return (
      <AspectRatio ratio={RATIO} maw={MAX_WIDTH} aria-busy="true">
        <Box pos="relative">
          <Skeleton pos="absolute" inset={0} h="100%" radius="sm" />
          <Center pos="relative" h="100%">
            <Text size="xs" c="dimmed">
              Taking snapshot…
            </Text>
          </Center>
        </Box>
      </AspectRatio>
    )
  }

  if (state === 'missing') {
    return (
      <AspectRatio ratio={RATIO} maw={MAX_WIDTH}>
        <Paper withBorder radius="sm" p="xs">
          <Center h="100%">
            <Text size="xs" c="dimmed" ta="center">
              No snapshot for this check.
              {canRetry ? ' Check again to take one.' : ''}
            </Text>
          </Center>
        </Paper>
      </AspectRatio>
    )
  }

  return (
    <>
      <UnstyledButton
        maw={MAX_WIDTH}
        w="100%"
        aria-label={`View snapshot of ${subject}, taken at ${takenAt}`}
        onClick={() => {
          open()
          track(websiteEvents.snapshotViewed)
        }}
      >
        <AspectRatio ratio={RATIO}>
          <Image src={thumbSrc} alt="" width={400} height={250} radius="sm" fit="cover" />
        </AspectRatio>
      </UnstyledButton>
      <SnapshotModal
        opened={opened}
        onClose={close}
        title={`${websiteName} · ${roundLabel}`}
        src={fullSrc}
        alt={`Snapshot of ${subject}, taken at ${takenAt}`}
        takenAt={takenAt}
      />
    </>
  )
}
