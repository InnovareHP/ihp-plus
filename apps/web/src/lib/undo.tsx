'use client'

import { Button, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import touch from '@/components/touch-target.module.css'

/** Long enough to notice the row go, short enough that nobody waits on it. */
export const UNDO_WINDOW_MS = 8000

export interface UndoOffer {
  message: string
  undoLabel: string
  onUndo: () => void
  onCommit: () => void
}

const pending = new Map<string, { onCommit: () => void; timer: ReturnType<typeof setTimeout> }>()

function commit(id: string) {
  const entry = pending.get(id)
  if (!entry) return
  pending.delete(id)
  clearTimeout(entry.timer)
  notifications.hide(id)
  entry.onCommit()
}

function cancel(id: string) {
  const entry = pending.get(id)
  pending.delete(id)
  if (entry) clearTimeout(entry.timer)
}

// Closing the tab never fires the toast's onClose, so open windows commit as the page goes.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => [...pending.keys()].forEach(commit))
}

/**
 * The server is not told anything until the window closes, so undo is a cancelled call rather
 * than a second one — dismissing the toast is the commit.
 */
export function offerUndo({ message, undoLabel, onUndo, onCommit }: UndoOffer) {
  const id = `undo-${crypto.randomUUID()}`
  // Timed from the delete, not the toast, so an undo queued behind an error toast still commits.
  pending.set(id, { onCommit, timer: setTimeout(() => commit(id), UNDO_WINDOW_MS) })

  notifications.show({
    id,
    autoClose: UNDO_WINDOW_MS,
    message: (
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Text size="sm">{message}</Text>
        <Button
          size="compact-sm"
          variant="subtle"
          className={touch.target}
          onClick={() => {
            cancel(id)
            notifications.hide(id)
            onUndo()
          }}
        >
          {undoLabel}
        </Button>
      </Group>
    ),
    onClose: () => commit(id),
  })
}
