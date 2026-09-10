'use client'

import { Group, Stack, Text } from '@mantine/core'
import type { FormField, RequestValues } from '../schema'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })
const number = new Intl.NumberFormat('en-US')

// The answers are shown against the fields the request was submitted with, not the form's
// current ones, so a later edit never rewrites history.
export function RequestAnswers({
  fields,
  values,
}: {
  fields: readonly FormField[]
  values: RequestValues
}) {
  if (fields.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        This request carries no answers.
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
            {answerText(field, values[field.id])}
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
