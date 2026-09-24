'use client'

import { Checkbox, NumberInput, Select, Textarea, TextInput } from '@mantine/core'
import { Controller, type Control, type FieldValues } from 'react-hook-form'
import type { FieldType, FormField } from '@/features/requests/schema'

// A field the admin left without a placeholder still says what an answer looks like.
const DEFAULT_PLACEHOLDERS: Record<FieldType, string> = {
  text: 'Type your answer',
  textarea: 'Type your answer',
  number: '0',
  date: 'mm/dd/yyyy',
  select: 'Choose an option',
  checkbox: '',
  file: 'Choose a file',
}

export interface FieldInputProps {
  field: FormField
  control: Control<FieldValues>
  error: string | undefined
}

// One admin-defined question, rendered as the Mantine control its type calls for — a request
// form and an evaluation form both ask through it. Every arm goes through Controller because
// the control owns its own value.
export function FieldInput({ field, control, error }: FieldInputProps) {
  const shared = {
    label: field.label,
    description: field.help || undefined,
    placeholder: field.placeholder || DEFAULT_PLACEHOLDERS[field.type],
    required: field.required,
    'aria-required': field.required || undefined,
    error,
    errorProps: { role: 'alert' as const },
  }

  return (
    <Controller
      control={control}
      name={field.id}
      render={({ field: bound }) => {
        switch (field.type) {
          case 'textarea':
            return (
              <Textarea
                {...shared}
                autosize
                minRows={3}
                value={String(bound.value ?? '')}
                onChange={(event) => bound.onChange(event.currentTarget.value)}
                onBlur={bound.onBlur}
              />
            )

          case 'number':
            return (
              <NumberInput
                {...shared}
                min={field.min}
                max={field.max}
                value={typeof bound.value === 'number' ? bound.value : ''}
                onChange={(value) => bound.onChange(value === '' ? '' : Number(value))}
                onBlur={bound.onBlur}
              />
            )

          case 'date':
            return (
              <TextInput
                {...shared}
                type="date"
                value={String(bound.value ?? '')}
                onChange={(event) => bound.onChange(event.currentTarget.value)}
                onBlur={bound.onBlur}
              />
            )

          case 'select':
            return (
              <Select
                {...shared}
                data={field.options}
                searchable={field.options.length > 8}
                value={bound.value ? String(bound.value) : null}
                onChange={(value) => bound.onChange(value ?? '')}
                onBlur={bound.onBlur}
              />
            )

          case 'checkbox':
            return (
              <Checkbox
                label={field.label}
                description={field.help || undefined}
                required={field.required}
                aria-required={field.required || undefined}
                error={error}
                checked={Boolean(bound.value)}
                onChange={(event) => bound.onChange(event.currentTarget.checked)}
                onBlur={bound.onBlur}
              />
            )

          case 'text':
          default:
            return (
              <TextInput
                {...shared}
                value={String(bound.value ?? '')}
                onChange={(event) => bound.onChange(event.currentTarget.value)}
                onBlur={bound.onBlur}
              />
            )
        }
      }}
    />
  )
}
