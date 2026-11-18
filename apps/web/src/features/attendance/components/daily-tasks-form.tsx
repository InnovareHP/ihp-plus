'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ActionIcon, Box, Button, Fieldset, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconPlayerPlay, IconPlus, IconTrash } from '@tabler/icons-react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import actions from '@/components/action-row.module.css'
import {
  dailyTasksFormSchema,
  MIN_DAILY_TASKS,
  type BacklogTaskRow,
  type DailyPlan,
  type DailyTasksFormValues,
} from '../schema'
import { BacklogTaskChoice } from './backlog-task-choice'

export interface DailyTasksFormProps {
  /** Unfinished daily tasks from earlier days, each carried over unless the person says otherwise. */
  backlog: readonly BacklogTaskRow[]
  isPending: boolean
  disabled: boolean
  onSubmit: (plan: DailyPlan) => void
}

function planOf(values: DailyTasksFormValues): DailyPlan {
  const idsFor = (action: string) =>
    values.backlog.filter((task) => task.action === action).map((task) => task.id)
  return {
    dailyTasks: values.tasks.map((task) => task.name).filter(Boolean),
    carriedTaskIds: idsFor('carry'),
    doneTaskIds: idsFor('done'),
    droppedTaskIds: idsFor('drop'),
  }
}

/** The plan for the day, asked at every clock-in; each line becomes a task on the board. */
export function DailyTasksForm({ backlog, isPending, disabled, onSubmit }: DailyTasksFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<DailyTasksFormValues>({
    resolver: zodResolver(dailyTasksFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      backlog: backlog.map((task) => ({ id: task.id, action: 'carry' })),
      tasks: Array.from({ length: MIN_DAILY_TASKS }, () => ({ name: '' })),
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'tasks' })
  const [choices = [], tasks = []] = useWatch({ control, name: ['backlog', 'tasks'] })
  const carried = choices.filter((choice) => choice.action === 'carry').length
  const stillNeeded = Math.max(0, MIN_DAILY_TASKS - carried)

  return (
    <form
      noValidate
      onSubmit={handleSubmit(
        (values) => onSubmit(planOf(values)),
        () => {
          const empty = tasks.findIndex((task) => !task.name.trim())
          if (empty >= 0) setFocus(`tasks.${empty}.name`)
        },
      )}
    >
      <Stack gap="sm">
        {backlog.length > 0 ? (
          <Fieldset variant="unstyled" legend="Left over from before">
            <Stack gap="xs">
              {backlog.map((task, index) => (
                <Controller
                  key={task.id}
                  control={control}
                  name={`backlog.${index}.action`}
                  render={({ field }) => (
                    <BacklogTaskChoice task={task} value={field.value} onChange={field.onChange} />
                  )}
                />
              ))}
            </Stack>
          </Fieldset>
        ) : null}

        <Fieldset variant="unstyled" legend="What will you get done today?">
          <Stack gap="xs">
            {stillNeeded > 0 ? (
              <Text size="sm" c="dimmed">
                Add at least {stillNeeded}.
              </Text>
            ) : null}
            {fields.map((field, index) => (
              <Group key={field.id} align="flex-end" wrap="nowrap" gap="xs">
                <TextInput
                  flex={1}
                  label={`Task ${index + 1}`}
                  required={index < stillNeeded}
                  aria-required={index < stillNeeded}
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
