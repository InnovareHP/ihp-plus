'use client'

import { Modal } from '@mantine/core'
import type { TaskFormValues, TaskListRow } from '../schema'
import { TaskForm } from './task-form'

export interface TaskFormModalProps {
  opened: boolean
  onClose: () => void
  title: string
  submitLabel: string
  lists: readonly TaskListRow[]
  people: readonly { value: string; label: string }[]
  defaults: TaskFormValues
  onSave: (values: TaskFormValues) => Promise<void>
}

export function TaskFormModal({
  opened,
  onClose,
  title,
  submitLabel,
  lists,
  people,
  defaults,
  onSave,
}: TaskFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': `Close ${title.toLowerCase()}` }}
    >
      {/* Keyed on the task so opening a different one resets the fields without an effect. */}
      <TaskForm
        key={defaults.name || 'new'}
        lists={lists}
        people={people}
        defaults={defaults}
        submitLabel={submitLabel}
        onSave={onSave}
        onClose={onClose}
      />
    </Modal>
  )
}
