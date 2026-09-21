'use client'

import { ActionIcon, Group, Paper, Text } from '@mantine/core'
import { IconFile, IconX } from '@tabler/icons-react'
import { formatFileSize } from './attachment-chip'

export interface StagedFileChipProps {
  file: File
  onRemove: (file: File) => void
}

// A file the composer is holding: nothing is stored until the comment it belongs to is posted,
// so there is no link to open and no uploader to name yet.
export function StagedFileChip({ file, onRemove }: StagedFileChipProps) {
  return (
    <Paper withBorder radius="md" px="sm" py={6}>
      <Group gap="xs" wrap="nowrap">
        <IconFile size={16} aria-hidden />

        <div style={{ minWidth: 0 }}>
          <Text size="sm" lineClamp={1}>
            {file.name}
          </Text>
          <Text size="xs" c="dimmed">
            {formatFileSize(file.size)} · posts with this comment
          </Text>
        </div>

        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`Remove ${file.name}`}
          onClick={() => onRemove(file)}
        >
          <IconX size={16} aria-hidden />
        </ActionIcon>
      </Group>
    </Paper>
  )
}
