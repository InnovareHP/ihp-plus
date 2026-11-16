'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ActionIcon, Box, Button, Fieldset, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconPlayerPlay, IconPlus, IconTrash } from '@tabler/icons-react'
import { useFieldArray, useForm } from 'react-hook-form'
import actions from '@/components/action-row.module.css'
import { dailyTasksFormSchema, MIN_DAILY_TASKS, type DailyTasksFormValues } from '../schema'

export interface DailyTasksFormProps {
  isPending: boolean
  disabled: boolean
  onSubmit: (names: string[]) => void
}

/** The plan for the day, asked at every clock-in; each line becomes a task on the board. */
export function DailyTasksForm({ isPending, disabled, onSubmit }: DailyTasksFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DailyTasksFormValues>({
    resolver: zodResolver(dailyTasksFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { tasks: Array.from({ length: MIN_DAILY_TASKS }, () => ({ name: '' })) },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'tasks' })

  return (
    <form noValidate onSubmit={handleSubmit((values) => onSubmit(values.tasks.map((t) => t.name)))}>
      <Stack gap="sm">
        <Fieldset variant="unstyled" legend="What will you get done today?">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              List at least {MIN_DAILY_TASKS}. Each one lands in Tasks, assigned to you and due
              today.
            </Text>
            {fields.map((field, index) => (
              <Group key={field.id} align="flex-end" wrap="nowrap" gap="xs">
                <TextInput
                  flex={1}
                  label={`Task ${index + 1}`}
                  required={index < MIN_DAILY_TASKS}
                  aria-required={index < MIN_DAILY_TASKS}
                  error={errors.tasks?.[index]?.name?.message}
                  errorProps={{ role: 'alert' }}
                  {...register(`tasks.${index}.name`)}
                />
                {index >= MIN_DAILY_TASKS ? (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={36}
                    aria-label={`Remove task ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                ) : null}
              </Group>
            ))}
            {errors.tasks?.root?.message ? (
              <Text size="sm" c="red" role="alert">
                {errors.tasks.root.message}
              </Text>
            ) : null}
          </Stack>
        </Fieldset>

        <Box className={actions.row}>
          <Button
            variant="default"
            leftSection={<IconPlus size={18} />}
            onClick={() => append({ name: '' })}
            disabled={fields.length >= 20}
            size="md"
          >
            Add another task
          </Button>
          <Button
            type="submit"
            leftSection={<IconPlayerPlay size={18} />}
            loading={isPending}
            disabled={disabled}
            size="md"
          >
            {isPending ? 'Clocking in…' : 'Clock in'}
          </Button>
        </Box>
      </Stack>
    </form>
  )
}
