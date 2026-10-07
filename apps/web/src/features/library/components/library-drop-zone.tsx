'use client'

import { Box, Overlay, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'
import { useState, type DragEvent, type ReactNode } from 'react'

export interface LibraryDropZoneProps {
  /** Where a drop lands, named in the overlay so nobody drops into the wrong folder. */
  folderLabel: string
  onDrop: (transfer: DataTransfer) => void
  children: ReactNode
}

// Text dragged off the page also fires drag events; only files may light the zone up.
function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/** A pointer shortcut for the toolbar's upload buttons, which stay the keyboard path. */
export function LibraryDropZone({ folderLabel, onDrop, children }: LibraryDropZoneProps) {
  const [isOver, setOver] = useState(false)

  return (
    <Box
      pos="relative"
      onDragOver={(event) => {
        if (!carriesFiles(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setOver(true)
      }}
      onDragLeave={(event) => {
        // Moving onto a child fires a leave on the parent, which must not drop the overlay.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setOver(false)
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) return
        event.preventDefault()
        setOver(false)
        onDrop(event.dataTransfer)
      }}
    >
      {children}
      {isOver ? (
        <Overlay
          color="var(--mantine-color-body)"
          backgroundOpacity={0.9}
          radius="md"
          blur={1}
          zIndex={2}
          style={{ border: '2px dashed var(--mantine-primary-color-filled)' }}
        >
          <Stack h="100%" align="center" justify="center" gap="xs">
            <ThemeIcon size="xl" variant="light" aria-hidden>
              <IconUpload size={22} />
            </ThemeIcon>
            <Text fw={600}>Drop to upload to {folderLabel}</Text>
            <Text size="sm" c="dimmed">
              Folders keep their structure.
            </Text>
          </Stack>
        </Overlay>
      ) : null}
    </Box>
  )
}
