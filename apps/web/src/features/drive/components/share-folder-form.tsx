'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { EMPTY_SHARE_FOLDER, shareFolderSchema, type ShareFolderValues } from '../schema'

export interface ShareFolderFormProps {
  clientName: string
  onShare: (values: ShareFolderValues) => Promise<void>
}

export function ShareFolderForm({ clientName, onShare }: ShareFolderFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShareFolderValues>({
    resolver: zodResolver(shareFolderSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: EMPTY_SHARE_FOLDER,
  })

  async function onSubmit(values: ShareFolderValues) {
    try {
      await onShare(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not share this folder.',
      })
      return
    }
    reset(EMPTY_SHARE_FOLDER)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="sm">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not share the folder">
            {errors.root.message}
          </Alert>
        ) : null}

        <Text size="sm" c="dimmed">
          They sign in with the address below to open {clientName}&apos;s folder.
        </Text>

        {/* Both fields carry one line of description, so the inputs line up. */}
        <Group grow align="flex-start">
          <TextInput
            {...register('email')}
            label="Email address"
            description="Their sign-in address."
            placeholder="name@company.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            aria-required="true"
            error={errors.email?.message}
            data-autofocus
          />
          <TextInput
            {...register('name')}
            label="Name"
            description="Shown on their guest account."
            placeholder="Dana Reyes"
            autoComplete="name"
            error={errors.name?.message}
          />
        </Group>

        <Group justify="flex-end">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Sharing…' : 'Share folder'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
