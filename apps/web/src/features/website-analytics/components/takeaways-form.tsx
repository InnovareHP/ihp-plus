'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Group, Stack, Text, Textarea } from '@mantine/core'
import { useForm } from 'react-hook-form'
import {
  TAKEAWAY_LABELS,
  TAKEAWAY_SECTIONS,
  takeawaysSchema,
  type TakeawaysValues,
} from '../schema'

const savedLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export interface TakeawaysFormProps {
  initial: TakeawaysValues
  savedAt: string | null
  /** Resolves to why saving failed, or null once it is saved. */
  onSave: (values: TakeawaysValues) => Promise<string | null>
}

export function TakeawaysForm({ initial, savedAt, onSave }: TakeawaysFormProps) {
  const form = useForm<TakeawaysValues>({
    resolver: zodResolver(takeawaysSchema),
    defaultValues: initial,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  })
  const { errors, isDirty, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    const problem = await onSave(values)
    if (problem) {
      // The typed text stays; only the reason is added beside it.
      form.setError('root', { message: problem })
      return
    }
    form.reset(values)
  })

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <Text size="sm">
          One point per line. Start a point with a short label and a colon, like “Traffic volume:
          …”, and the PDF sets the label in bold.
        </Text>

        {TAKEAWAY_SECTIONS.map((key) => (
          <Textarea
            key={key}
            label={TAKEAWAY_LABELS[key]}
            autosize
            minRows={3}
            maxRows={14}
            error={errors[key]?.message}
            {...form.register(key)}
          />
        ))}

        {errors.root?.message ? (
          <Alert color="red" variant="light" role="alert" title="The takeaways were not saved">
            {errors.root.message}
          </Alert>
        ) : null}

        <Group justify="space-between" gap="sm" wrap="wrap">
          <Text size="sm" aria-live="polite">
            {isDirty
              ? 'Unsaved changes'
              : savedAt
                ? `Saved ${savedLabel.format(new Date(savedAt))}`
                : 'Not saved yet'}
          </Text>
          <Button type="submit" loading={isSubmitting}>
            Save takeaways
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
