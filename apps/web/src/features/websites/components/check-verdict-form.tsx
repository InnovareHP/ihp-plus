'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Radio, Stack, Textarea } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import {
  CHECK_STATUSES,
  CHECK_STATUS_LABELS,
  checkNoteFormSchema,
  type CheckNoteFormInput,
} from '../schema'

export interface CheckVerdictFormProps {
  defaults: CheckNoteFormInput
  onSave: (values: CheckNoteFormInput) => Promise<void>
  onClose: () => void
}

/** The lead's word on a site, for what a status code cannot see: a broken form, a blank page. */
export function CheckVerdictForm({ defaults, onSave, onClose }: CheckVerdictFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckNoteFormInput>({
    resolver: zodResolver(checkNoteFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  })

  async function onSubmit(values: CheckNoteFormInput) {
    try {
      await onSave(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save this check.',
      })
      return
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not save this check">
            {errors.root.message}
          </Alert>
        ) : null}
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Radio.Group
              label="How is the site?"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.status?.message}
            >
              <Group mt="xs" gap="lg">
                {CHECK_STATUSES.map((status) => (
                  <Radio key={status} value={status} label={CHECK_STATUS_LABELS[status]} />
                ))}
              </Group>
            </Radio.Group>
          )}
        />
        <Textarea
          {...register('note')}
          label="Note"
          description="Required unless the site is running. Say what you saw."
          autosize
          minRows={3}
          error={errors.note?.message}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save check
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
