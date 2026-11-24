'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { DialogActions } from '@/components/dialog-actions'
import { checkTimeFormSchema, type CheckTimeFormInput } from '../schema'

export interface CheckTimeFormProps {
  defaults: CheckTimeFormInput
  /** Says how far the change reaches, for an edit of a whole round. */
  note?: string
  onSave: (values: CheckTimeFormInput) => Promise<void>
  onClose: () => void
}

/** An admin's fix for when a check ran, for a round recorded late or by the wrong clock. */
export function CheckTimeForm({ defaults, note, onSave, onClose }: CheckTimeFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckTimeFormInput>({
    resolver: zodResolver(checkTimeFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  })

  async function onSubmit(values: CheckTimeFormInput) {
    try {
      await onSave(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not change the time.',
      })
      return
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not change the time">
            {errors.root.message}
          </Alert>
        ) : null}
        {note ? <Text size="sm">{note}</Text> : null}
        <TextInput
          {...register('time')}
          type="time"
          label="Checked at"
          description="A time before noon counts as the morning after the shift began."
          required
          error={errors.time?.message}
          data-autofocus
        />
        <DialogActions>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save time
          </Button>
        </DialogActions>
      </Stack>
    </form>
  )
}
