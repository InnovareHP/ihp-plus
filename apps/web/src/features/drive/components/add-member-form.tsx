'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Select } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { addMemberSchema, type AddMemberValues, type GroupableClient } from '../schema'

export interface AddMemberFormProps {
  groupId: string
  groupName: string
  clients: readonly GroupableClient[]
  /** Names the group each client sits in now, so moving one out of another group is visible. */
  groupNameOf: (groupId: string) => string | undefined
  onAdd: (clientId: string) => Promise<void>
}

export function AddMemberForm({
  groupId,
  groupName,
  clients,
  groupNameOf,
  onAdd,
}: AddMemberFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { clientId: '' },
  })

  const options = clients
    .filter((client) => client.groupId !== groupId)
    .map((client) => {
      const current = client.groupId ? groupNameOf(client.groupId) : undefined
      return { value: client.id, label: current ? `${client.name} (in ${current})` : client.name }
    })

  async function onSubmit(values: AddMemberValues) {
    try {
      await onAdd(values.clientId)
    } catch (error) {
      setError('clientId', {
        message: error instanceof Error ? error.message : 'Could not add that company.',
      })
      return
    }
    reset({ clientId: '' })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={`Add a company to ${groupName}`}>
      <Group align="flex-end" gap="sm" wrap="wrap">
        <Controller
          control={control}
          name="clientId"
          render={({ field }) => (
            <Select
              label="Add a company"
              placeholder="Search clients"
              data={options}
              searchable
              nothingFoundMessage="No other clients to add"
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              onBlur={field.onBlur}
              ref={field.ref}
              error={errors.clientId?.message}
              w={280}
              maw="100%"
            />
          )}
        />
        <Button type="submit" variant="default" loading={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add company'}
        </Button>
      </Group>
    </form>
  )
}
