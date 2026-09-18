'use client'

import {
  ActionIcon,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconTrash } from '@tabler/icons-react'
import { Controller, type Control, type UseFormRegister } from 'react-hook-form'
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type FormDraftInput,
  type FormDraftValues,
} from '../schema'

const TYPE_OPTIONS = FIELD_TYPES.map((type) => ({ value: type, label: FIELD_TYPE_LABELS[type] }))

interface QuestionCardProps {
  index: number
  total: number
  control: Control<FormDraftInput, unknown, FormDraftValues>
  register: UseFormRegister<FormDraftInput>
  type: FormDraftValues['fields'][number]['type']
  labelError: string | undefined
  optionsError: string | undefined
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

export function QuestionCard({
  index,
  total,
  control,
  register,
  type,
  labelError,
  optionsError,
  onMoveUp,
  onMoveDown,
  onRemove,
}: QuestionCardProps) {
  return (
    <Card padding="md" component="fieldset" bd="1px solid var(--mantine-color-default-border)">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Text component="legend" size="sm" fw={600}>
          Question {index + 1}
        </Text>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            disabled={index === 0}
            aria-label={`Move question ${index + 1} up`}
            onClick={onMoveUp}
          >
            <IconArrowUp size={16} aria-hidden />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            disabled={index === total - 1}
            aria-label={`Move question ${index + 1} down`}
            onClick={onMoveDown}
          >
            <IconArrowDown size={16} aria-hidden />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={`Remove question ${index + 1}`}
            onClick={onRemove}
          >
            <IconTrash size={16} aria-hidden />
          </ActionIcon>
        </Group>
      </Group>

      <Stack gap="sm">
        <Group grow align="flex-start">
          <TextInput
            {...register(`fields.${index}.label`)}
            label="Label"
            placeholder="What are you asking for?"
            required
            aria-required="true"
            error={labelError}
            errorProps={{ role: 'alert' }}
          />

          <Controller
            control={control}
            name={`fields.${index}.type`}
            render={({ field }) => (
              <Select
                label="Answer type"
                placeholder="Choose an answer type"
                data={TYPE_OPTIONS}
                allowDeselect={false}
                value={field.value}
                onChange={(value) => value && field.onChange(value)}
                onBlur={field.onBlur}
              />
            )}
          />
        </Group>

        <Group grow align="flex-start">
          <TextInput
            {...register(`fields.${index}.help`)}
            label="Help text"
            placeholder="Shown under the question"
            description="Shown under the label, before anyone makes a mistake."
          />

          <TextInput
            {...register(`fields.${index}.placeholder`)}
            label="Placeholder"
            placeholder="An example answer"
            description="Shown inside the empty field. Leave blank for the default."
          />
        </Group>

        {type === 'select' ? (
          <Controller
            control={control}
            name={`fields.${index}.options`}
            render={({ field }) => (
              <TagsInput
                label="Options"
                placeholder="Add an option"
                description="Press Enter after each one."
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={optionsError}
              />
            )}
          />
        ) : null}

        {type === 'number' ? (
          <Group grow align="flex-start">
            <Controller
              control={control}
              name={`fields.${index}.min`}
              render={({ field }) => (
                <NumberInput
                  label="Lowest allowed"
                  placeholder="0"
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                  onBlur={field.onBlur}
                />
              )}
            />
            <Controller
              control={control}
              name={`fields.${index}.max`}
              render={({ field }) => (
                <NumberInput
                  label="Highest allowed"
                  placeholder="100"
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Group>
        ) : null}

        <Controller
          control={control}
          name={`fields.${index}.required`}
          render={({ field }) => (
            <Checkbox
              label="Required"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
            />
          )}
        />
      </Stack>
    </Card>
  )
}
