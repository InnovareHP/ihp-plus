'use client'

import { Image, Modal, Stack, Text } from '@mantine/core'

export interface SnapshotModalProps {
  opened: boolean
  onClose: () => void
  title: string
  src: string
  alt: string
  takenAt: string
}

export function SnapshotModal({ opened, onClose, title, src, alt, takenAt }: SnapshotModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" centered>
      <Stack gap="sm">
        <Image src={src} alt={alt} width={1280} height={800} radius="sm" />
        <Text size="sm" c="dimmed">
          Taken at {takenAt}. Snapshots are kept for today only.
        </Text>
      </Stack>
    </Modal>
  )
}
