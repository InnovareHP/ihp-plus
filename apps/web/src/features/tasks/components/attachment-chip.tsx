'use client'

import { ActionIcon, Anchor, Group, Image, Paper, Text } from '@mantine/core'
import { IconFile, IconX } from '@tabler/icons-react'
import type { TaskAttachmentRow } from '../schema'

export interface AttachmentChipProps {
  file: TaskAttachmentRow
  /** Absent for a file the viewer did not upload, which they may not remove. */
  onRemove?: (file: TaskAttachmentRow) => void
  isRemoving?: boolean
}

const UNITS = ['B', 'KB', 'MB'] as const

export function formatFileSize(bytes: number) {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`
}

export function AttachmentChip({ file, onRemove, isRemoving }: AttachmentChipProps) {
  return (
    <Paper withBorder radius="md" px="sm" py={6}>
      <Group gap="xs" wrap="nowrap">
        {/* Sized in the markup: a thumbnail that loads late must not shove the row around. */}
        {file.contentType.startsWith('image/') && file.url ? (
          <Image
            src={file.url}
            alt=""
            w={36}
            h={36}
            radius="sm"
            fit="cover"
            style={{ flexShrink: 0 }}
          />
        ) : (
          <IconFile size={16} aria-hidden />
        )}

        <div style={{ minWidth: 0 }}>
          {/* An unsigned link means storage is unreachable, not that the file is gone. */}
          {file.url ? (
            <Anchor href={file.url} target="_blank" rel="noreferrer" size="sm" lineClamp={1}>
              {file.fileName}
            </Anchor>
          ) : (
            <Text size="sm" lineClamp={1}>
              {file.fileName}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {formatFileSize(file.fileSize)} · {file.uploadedByName}
          </Text>
        </div>

        {onRemove ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Remove ${file.fileName}`}
            loading={isRemoving}
            onClick={() => onRemove(file)}
          >
            <IconX size={16} aria-hidden />
          </ActionIcon>
        ) : null}
      </Group>
    </Paper>
  )
}
