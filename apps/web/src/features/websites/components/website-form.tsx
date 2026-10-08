'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import {
  websiteDraftSchema,
  type ClientOption,
  type WebsiteDraftInput,
  type WebsiteDraftValues,
} from '../schema'

export interface WebsiteFormProps {
  defaults: WebsiteDraftInput
  clients: readonly ClientOption[]
  clientsLoading: boolean
  submitLabel: string
  onSave: (values: WebsiteDraftValues) => Promise<void>
  onClose: () => void
}

export function WebsiteForm({
  defaults,
  clients,
  clientsLoading,
  submitLabel,
  onSave,
  onClose,
}: WebsiteFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WebsiteDraftInput, unknown, WebsiteDraftValues>({
    resolver: zodResolver(websiteDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  })

  async function onSubmit(values: WebsiteDraftValues) {
    try {
      await onSave(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save this website.',
      })
      return
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not save this website">
            {errors.root.message}
          </Alert>
        ) : null}
        <TextInput
          {...register('name')}
          label="Name"
          placeholder="Riverside Care Center site"
          required
          aria-required="true"
          error={errors.name?.message}
          data-autofocus
        />
        <TextInput
          {...register('url')}
          label="Address"
          placeholder="https://example.com"
          type="url"
          inputMode="url"
          autoComplete="url"
          required
          aria-required="true"
          error={errors.url?.message}
        />
        <Controller
          control={control}
          name="clientId"
          render={({ field }) => (
            <Select
              label="Client"
              placeholder={clientsLoading ? 'Loading clients…' : 'Pick the client this site is for'}
              data={clients.map((client) => ({ value: client.id, label: client.name }))}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? '')}
              onBlur={field.onBlur}
              clearable
              searchable
              nothingFoundMessage="No client by that name"
              error={errors.clientId?.message}
            />
          )}
        />
        <Textarea
          {...register('notes')}
          label="Notes"
          description="Hosting, who to call when it is down — whatever the next check needs."
          autosize
          minRows={2}
          error={errors.notes?.message}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
