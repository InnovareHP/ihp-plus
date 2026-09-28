'use client'

import { ActionIcon, Card, Group, Stack, Text } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { describeMoment } from '@/lib/relative-time'
import type { ApplicationNote } from '../schema'

export interface ApplicationNotesProps {
  notes: readonly ApplicationNote[]
  onDelete: (note: ApplicationNote) => void
}

export function ApplicationNotes({ notes, onDelete }: ApplicationNotesProps) {
  if (notes.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No notes yet. What the team thinks after a call or an interview goes here.
      </Text>
    )
  }

  return (
    <Stack component="ul" gap="sm" m={0} p={0} aria-label="Notes">
      {notes.map((note) => {
        const pending = note.id.startsWith('pending-')
        return (
          <Card
            key={note.id}
            component="li"
            withBorder
            padding="sm"
            opacity={pending ? 0.6 : undefined}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <Stack gap={4} miw={0}>
                <Text size="xs" c="dimmed">
                  {note.authorName} · {describeMoment(note.createdAt)}
                </Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {note.body}
                </Text>
              </Stack>
              {note.isMine && !pending ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label={`Delete your note from ${describeMoment(note.createdAt)}`}
                  onClick={() => onDelete(note)}
                >
                  <IconTrash size={16} aria-hidden />
                </ActionIcon>
              ) : null}
            </Group>
          </Card>
        )
      })}
    </Stack>
  )
}
