'use client'

import { Button, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'

/** Long enough to notice the row go, short enough that nobody waits on it. */
export const UNDO_WINDOW_MS = 8000

export interface UndoOffer {
  message: string
  undoLabel: string
  onUndo: () => void
  onCommit: () => void
}

/**
 * The server is not told anything until the window closes, so undo is a cancelled call rather
 * than a second one — dismissing the toast is the commit.
 */
export function offerUndo({ message, undoLabel, onUndo, onCommit }: UndoOffer) {
  const id = `undo-${crypto.randomUUID()}`
  let undone = false

  notifications.show({
    id,
    autoClose: UNDO_WINDOW_MS,
    message: (
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Text size="sm">{message}</Text>
        <Button
          size="compact-sm"
          variant="subtle"
          onClick={() => {
            undone = true
            notifications.hide(id)
            onUndo()
          }}
        >
          {undoLabel}
        </Button>
      </Group>
    ),
    onClose: () => {
      if (!undone) onCommit()
    },
  })
}
