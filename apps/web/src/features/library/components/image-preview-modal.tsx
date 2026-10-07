'use client'

import { ActionIcon, Box, Button, Group, Image, Modal, Skeleton, Stack, Text } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconChevronLeft, IconChevronRight, IconDownload } from '@tabler/icons-react'
import { useState } from 'react'
import type { LibraryEntry } from '../schema'
import { libraryFileUrl } from '../utils/library-file'

export interface ImagePreviewModalProps {
  /** Every image in the open folder, in the order the table shows them. */
  images: LibraryEntry[]
  activeId: string
  onSelect: (itemId: string) => void
  onClose: () => void
}

// A fixed frame, so stepping between tall and wide pictures never moves the controls.
const FRAME_HEIGHT = 'min(65vh, 640px)'

export function ImagePreviewModal({ images, activeId, onSelect, onClose }: ImagePreviewModalProps) {
  const index = images.findIndex((image) => image.id === activeId)
  const active = images[index]
  const previous = images[index - 1]
  const next = images[index + 1]

  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useHotkeys([
    ['ArrowLeft', () => previous && onSelect(previous.id)],
    ['ArrowRight', () => next && onSelect(next.id)],
  ])

  const src = active ? libraryFileUrl(active, 'preview') : undefined

  return (
    <Modal
      opened={active !== undefined}
      onClose={onClose}
      title={active?.name}
      size="xl"
      centered
      styles={{ title: { overflowWrap: 'anywhere' } }}
    >
      {active && src ? (
        <Stack gap="md">
          <Box h={FRAME_HEIGHT} pos="relative" aria-busy={loaded !== src && failed !== src}>
            {loaded !== src && failed !== src ? (
              <Skeleton pos="absolute" inset={0} h="100%" />
            ) : null}
            {failed === src ? (
              <Stack h="100%" align="center" justify="center" gap="xs" role="alert">
                <Text fw={600}>This picture could not be shown</Text>
                <Text size="sm" c="dimmed">
                  Download it instead, or try again in a moment.
                </Text>
              </Stack>
            ) : (
              <Image
                src={src}
                alt={active.name}
                h="100%"
                w="100%"
                fit="contain"
                onLoad={() => setLoaded(src)}
                onError={() => setFailed(src)}
              />
            )}
          </Box>

          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="xs">
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Previous image"
                disabled={!previous}
                onClick={() => previous && onSelect(previous.id)}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text size="sm" c="dimmed" aria-live="polite">
                {index + 1} of {images.length}
              </Text>
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Next image"
                disabled={!next}
                onClick={() => next && onSelect(next.id)}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
            <Button
              component="a"
              href={libraryFileUrl(active, 'original', { download: true })}
              variant="default"
              leftSection={<IconDownload size={16} />}
            >
              Download
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  )
}
