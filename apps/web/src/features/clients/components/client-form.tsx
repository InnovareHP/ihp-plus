'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Anchor,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm } from 'react-hook-form'
import {
  CLIENT_FIELD_LOOKUPS,
  clientDraftSchema,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUSES,
  type ClientDraftValues,
  type ClientLookupKind,
  type ClientOptionMap,
} from '../schema'

const STATUS_OPTIONS = CLIENT_STATUSES.map((status) => ({
  value: status,
  label: CLIENT_STATUS_LABELS[status],
}))

export function ClientForm({
  submitLabel,
  owners,
  options,
  onManageOptions,
  defaults,
  onSave,
  onClose,
}: {
  submitLabel: string
  owners: { value: string; label: string }[]
  options: ClientOptionMap
  onManageOptions: (kind: ClientLookupKind) => void
  defaults: ClientDraftValues
  onSave: (values: ClientDraftValues) => Promise<void>
  onClose: () => void
}) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientDraftValues>({
    resolver: zodResolver(clientDraftSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaults,
  })

  async function onSubmit(values: ClientDraftValues) {
    try {
      await onSave(values)
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not save this client.',
      })
      return
    }
    onClose()
  }

  // Every curated dropdown behaves the same: values from the option set, plus a way to extend it.
  function optionField(field: keyof typeof CLIENT_FIELD_LOOKUPS, label: string) {
    const kind = CLIENT_FIELD_LOOKUPS[field]

    return (
      <Select
        label={label}
        placeholder={`Choose a ${label.toLowerCase()}`}
        description={
          <Anchor component="button" type="button" size="xs" onClick={() => onManageOptions(kind)}>
            Manage options
          </Anchor>
        }
        data={options[kind] ?? []}
        value={watch(field)}
        onChange={(value) => setValue(field, value ?? '', { shouldDirty: true })}
        clearable
        searchable
        nothingFoundMessage="No match — add it under Manage options"
        error={errors[field]?.message}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        {errors.root ? (
          <Alert role="alert" color="red" variant="light" title="Could not save this client">
            {errors.root.message}
          </Alert>
        ) : null}

        <TextInput
          {...register('name')}
          label="Client name"
          placeholder="Riverside Care Center"
          required
          aria-required="true"
          error={errors.name?.message}
          data-autofocus
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            {...register('contactName')}
            label="Main contact"
            placeholder="Dana Reyes"
            autoComplete="name"
            error={errors.contactName?.message}
          />
          <Select
            label="Status"
            placeholder="Choose a status"
            data={STATUS_OPTIONS}
            value={watch('status')}
            allowDeselect={false}
            onChange={(value) =>
              value &&
              setValue('status', value as ClientDraftValues['status'], { shouldDirty: true })
            }
            error={errors.status?.message}
          />
          <TextInput
            {...register('email')}
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="dana@riversidecare.com"
            error={errors.email?.message}
          />
          <TextInput
            {...register('phone')}
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(609) 555-0134"
            error={errors.phone?.message}
          />
          {optionField('type', 'Client type')}
          {optionField('serviceLine', 'Service line')}
          {optionField('source', 'Source')}
          <Select
            label="Account owner"
            placeholder="Choose an owner"
            description="Who handles this client."
            data={owners}
            value={watch('ownerId')}
            clearable
            searchable
            nothingFoundMessage="No match"
            onChange={(value) => setValue('ownerId', value ?? '', { shouldDirty: true })}
            error={errors.ownerId?.message}
          />
          {optionField('city', 'City')}
          {optionField('state', 'State')}
        </SimpleGrid>

        <TextInput
          {...register('lastContactAt')}
          label="Last contact"
          placeholder="mm/dd/yyyy"
          type="date"
          error={errors.lastContactAt?.message}
        />

        <TagsInput
          label="Tags"
          placeholder="Add a tag"
          description="Pick from the curated list or type a new one."
          data={options.clientTag ?? []}
          value={watch('tags')}
          onChange={(tags) => setValue('tags', tags, { shouldDirty: true })}
          clearable
          maxTags={20}
          error={errors.tags?.message}
        />

        <Textarea
          {...register('notes')}
          label="Notes"
          placeholder="What the next person picking this up needs to know"
          description="What the next person picking this up needs to know."
          autosize
          minRows={3}
          maxRows={8}
          error={errors.notes?.message}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
