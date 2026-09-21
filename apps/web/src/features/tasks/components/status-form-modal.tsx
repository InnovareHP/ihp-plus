'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, ColorInput, Group, Modal, Select, Stack, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import {
  statusFormSchema,
  TASK_STATUS_CATEGORIES,
  type StatusFormInput,
  type StatusFormValues,
  type TaskStatusRow,
} from '../schema'

const CATEGORY_LABELS: Record<(typeof TASK_STATUS_CATEGORIES)[number], string> = {
  active: 'Open work',
  done: 'Closes the task',
  cancelled: 'Retires the task',
}

export interface StatusFormModalProps {
  opened: boolean
  /** Set when an existing column is being renamed or recoloured. */
  status: TaskStatusRow | null
  onClose: () => void
  onSave: (values: StatusFormValues) => Promise<void>
}

export function StatusFormModal({ opened, status, onClose, onSave }: StatusFormModalProps) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StatusFormInput, unknown, StatusFormValues>({
    resolver: zodResolver(statusFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    values: {
      name: status?.name ?? '',
      color: status?.color ?? '#64748b',
      category: status?.category ?? 'active',
    },
  })

  async function submit(values: StatusFormValues) {
    try {
      await onSave(values)
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not save that column.',
      })
      return
    }
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      title={status ? 'Rename column' : 'New column'}
      closeButtonProps={{ 'aria-label': 'Close column form' }}
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Stack gap="md">
          <TextInput
            {...register('name')}
            label="Column name"
            placeholder="In review"
            required
            aria-required="true"
            error={errors.name?.message}
            errorProps={{ role: 'alert' }}
            data-autofocus
          />

          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <ColorInput
                label="Colour"
                description="Shown as the dot on the column and the badge on a row."
                format="hex"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.color?.message}
              />
            )}
          />

          {/* What a column means cannot change under the tasks already in it. */}
          {status ? null : (
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  label="What this column means"
                  description="Set once: it decides whether landing here completes a task."
                  data={TASK_STATUS_CATEGORIES.map((category) => ({
                    value: category,
                    label: CATEGORY_LABELS[category],
                  }))}
                  value={field.value}
                  onChange={(next) => field.onChange(next ?? 'active')}
                  onBlur={field.onBlur}
                  allowDeselect={false}
                />
              )}
            />
          )}

          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : status ? 'Save changes' : 'Add column'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
