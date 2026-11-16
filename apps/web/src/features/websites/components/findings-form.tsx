'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Stack, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { findingsFormSchema, type FindingsFormInput } from '../schema'

export interface FindingsFormProps {
  defaults: FindingsFormInput
  /** Today's list for the IT lead; anyone else reads the findings without editing them. */
  readOnly: boolean
  onSave: (values: FindingsFormInput) => Promise<void>
}

export function FindingsForm({ defaults, readOnly, onSave }: FindingsFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FindingsFormInput>({
    resolver: zodResolver(findingsFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  })

  async function onSubmit(values: FindingsFormInput) {
    try {
      await onSave(values)
      reset(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save the findings.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="sm">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not save the findings">
            {errors.root.message}
          </Alert>
        ) : null}
        <Textarea
          {...register('findings')}
          label="What you found"
          description="Anything broken or slow on the pages, buttons or form."
          autosize
          minRows={2}
          readOnly={readOnly}
          error={errors.findings?.message}
        />
        <Textarea
          {...register('action')}
          label="What you did"
          description="The fix, or who you told and the ticket number."
          autosize
          minRows={2}
          readOnly={readOnly}
          error={errors.action?.message}
        />
        {readOnly ? null : (
          <Group justify="flex-end">
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save findings'}
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  )
}
