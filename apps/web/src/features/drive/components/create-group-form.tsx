'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { clientGroupSchema, EMPTY_CLIENT_GROUP, type ClientGroupValues } from '../schema'

export interface CreateGroupFormProps {
  onCreate: (values: ClientGroupValues) => Promise<void>
}

export function CreateGroupForm({ onCreate }: CreateGroupFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientGroupValues>({
    resolver: zodResolver(clientGroupSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: EMPTY_CLIENT_GROUP,
  })

  async function onSubmit(values: ClientGroupValues) {
    try {
      await onCreate(values)
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not create that group.',
      })
      return
    }
    reset(EMPTY_CLIENT_GROUP)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Create a client group">
      <Group align="flex-end" gap="sm" wrap="wrap">
        <TextInput
          {...register('name')}
          label="Group name"
          description="Usually the owner or holding company."
          placeholder="Smith Holdings"
          autoComplete="off"
          required
          aria-required="true"
          error={errors.name?.message}
          w={320}
          maw="100%"
        />
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create group'}
        </Button>
      </Group>
    </form>
  )
}
