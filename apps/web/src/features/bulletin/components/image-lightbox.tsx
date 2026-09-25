'use client'

import { ActionIcon, Group, Image, Modal, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import type { BulletinImageRow } from '../schema'

export interface ImageLightboxProps {
  images: readonly BulletinImageRow[]
  /** The photo on show; undefined keeps the viewer closed. */
  index: number | undefined
  onIndexChange: (index: number) => void
  onClose: () => void
}

/** A post's photos at full size, stepped through with the arrows or the buttons. */
export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const image = index === undefined ? undefined : images[index]
  const count = images.length

  function step(by: number) {
    if (index === undefined) return
    onIndexChange((index + by + count) % count)
  }

  return (
    <Modal
      opened={image !== undefined}
      onClose={onClose}
      size="xl"
      centered
      radius="lg"
      title={index === undefined ? '' : `Photo ${index + 1} of ${count}`}
      closeButtonProps={{ 'aria-label': 'Close the photo' }}
      onKeyDown={(event) => {
        if (count < 2) return
        if (event.key === 'ArrowRight') step(1)
        if (event.key === 'ArrowLeft') step(-1)
      }}
    >
      {image ? (
        <>
          <Image
            src={image.url}
            alt={`Photo ${(index ?? 0) + 1} of ${count}`}
            fit="contain"
            mah="70vh"
            radius="md"
          />
          {count > 1 ? (
            <Group justify="space-between" mt="md">
              <ActionIcon
                variant="default"
                size="lg"
                radius="xl"
                aria-label="Previous photo"
                onClick={() => step(-1)}
              >
                <IconChevronLeft size={18} aria-hidden />
              </ActionIcon>
              <Text size="sm" c="dimmed">
                Use the arrow keys to move between photos.
              </Text>
              <ActionIcon
                variant="default"
                size="lg"
                radius="xl"
                aria-label="Next photo"
                onClick={() => step(1)}
              >
                <IconChevronRight size={18} aria-hidden />
              </ActionIcon>
            </Group>
          ) : null}
        </>
      ) : null}
    </Modal>
  )
}
