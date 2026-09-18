'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { newFolderSchema, type NewFolderValues } from '../schema'

export interface ItemNameFormProps {
  label: string
  description: string
  placeholder: string
  submitLabel: string
  pendingLabel: string
  errorTitle: string
  defaultName?: string
  onSubmit: (name: string) => Promise<void>
}

/** Naming a folder and renaming an item ask the same question, so they share the field. */
export function ItemNameForm({ defaultName = '', onSubmit, ...copy }: ItemNameFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewFolderValues>({
    resolver: zodResolver(newFolderSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { name: defaultName },
  })

  async function submit(values: NewFolderValues) {
    try {
      await onSubmit(values.name)
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'That did not work — try again.',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="sm">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title={copy.errorTitle}>
            {errors.root.message}
          </Alert>
        ) : null}

        <TextInput
          {...register('name')}
          label={copy.label}
          description={copy.description}
          placeholder={copy.placeholder}
          required
          aria-required="true"
          error={errors.name?.message}
          data-autofocus
        />

        <Group justify="flex-end">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? copy.pendingLabel : copy.submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
