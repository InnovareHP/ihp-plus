'use client'

import { Anchor, Group, Stack, Text } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { applicationFileHref } from '@/lib/routes'
import type { FormField } from '@/features/requests/schema'
import { RESUME_FIELD_ID, type ApplicationFile } from '../schema'

const size = new Intl.NumberFormat('en-US', {
  style: 'unit',
  unit: 'kilobyte',
  maximumFractionDigits: 0,
})

export interface ApplicationFilesProps {
  files: readonly ApplicationFile[]
  /** The questions the files answered, so each is named for what it is. */
  fields: readonly FormField[]
}

export function ApplicationFiles({ files, fields }: ApplicationFilesProps) {
  if (files.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        They did not attach any files.
      </Text>
    )
  }

  const labelOf = (fieldId: string) =>
    fieldId === RESUME_FIELD_ID
      ? 'Resume'
      : (fields.find((field) => field.id === fieldId)?.label ?? 'Attachment')

  return (
    <Stack component="ul" gap="xs" m={0} p={0} aria-label="Files">
      {files.map((file) => (
        <Group key={file.id} component="li" gap="sm" wrap="nowrap">
          <IconFileText size={18} aria-hidden />
          <Stack gap={0} miw={0}>
            <Anchor
              href={applicationFileHref(file.id)}
              target="_blank"
              rel="noopener"
              size="sm"
              style={{ overflowWrap: 'anywhere' }}
            >
              {file.fileName}
            </Anchor>
            <Text size="xs" c="dimmed">
              {labelOf(file.fieldId)} · {size.format(Math.max(1, Math.round(file.fileSize / 1024)))}
            </Text>
          </Stack>
        </Group>
      ))}
    </Stack>
  )
}
