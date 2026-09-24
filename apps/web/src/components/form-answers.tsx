'use client'

import { Anchor, Group, Stack, Text } from '@mantine/core'
import type { FormField, RequestValues } from '@/features/requests/schema'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })
const number = new Intl.NumberFormat('en-US')

// The answers are shown against the fields the form was submitted with, not the form's current
// ones, so a later edit never rewrites history.
export function FormAnswers({
  fields,
  values,
  fileHref,
}: {
  fields: readonly FormField[]
  values: RequestValues
  /** Where a file answer downloads from; without it the file's name shows as plain text. */
  fileHref?: (fieldId: string) => string
}) {
  if (fields.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        This form carries no answers.
      </Text>
    )
  }

  return (
    <Stack component="dl" gap="sm" m={0}>
      {fields.map((field) => (
        <Group key={field.id} gap="md" align="baseline" wrap="wrap">
          <Text component="dt" size="sm" c="dimmed" miw={180}>
            {field.label}
          </Text>
          <Text component="dd" size="sm" m={0} style={{ whiteSpace: 'pre-wrap' }}>
            {field.type === 'file' && fileHref && values[field.id] ? (
              <Anchor href={fileHref(field.id)} target="_blank" rel="noopener" size="sm">
                {String(values[field.id])}
              </Anchor>
            ) : (
              answerText(field, values[field.id])
            )}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

function answerText(field: FormField, value: string | number | boolean | undefined) {
  if (field.type === 'checkbox') return value ? 'Yes' : 'No'
  if (value === undefined || value === '') return 'Not answered'
  if (field.type === 'number') return number.format(Number(value))
  if (field.type === 'date') {
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(parsed.getTime()) ? String(value) : dateOnly.format(parsed)
  }
  return String(value)
}
