'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Menu, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { offerUndo } from '@/lib/undo'
import { useAddChecklistTask, useRemoveChecklistTask } from '../hooks/use-checklist-setup'
import {
  newTaskSchema,
  type ChecklistTaskRow,
  type NewTaskInput,
  type NewTaskValues,
} from '../schema'

const EMPTY_TASK: NewTaskInput = { title: '', description: '' }

export interface FirstDayTasksSetupProps {
  tasks: readonly ChecklistTaskRow[]
}

export function FirstDayTasksSetup({ tasks }: FirstDayTasksSetupProps) {
  const add = useAddChecklistTask()
  const remove = useRemoveChecklistTask()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewTaskInput, unknown, NewTaskValues>({
    resolver: zodResolver(newTaskSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: EMPTY_TASK,
  })

  function onSubmit(values: NewTaskValues) {
    add.mutate({ ...values, tempId: crypto.randomUUID() })
    reset(EMPTY_TASK)
  }

  function removeWithUndo(row: ChecklistTaskRow) {
    const previous = remove.apply({ taskId: row.id })
    offerUndo({
      message: `Removed ${row.title}`,
      undoLabel: 'Undo',
      onUndo: () => remove.restore(previous),
      onCommit: () => remove.commit.mutate({ taskId: row.id, previous }),
    })
  }

  const columns: DataTableColumn<ChecklistTaskRow>[] = [
    {
      key: 'title',
      header: 'Task',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.title}
          </Text>
          {row.description ? (
            <Text size="xs" c="dimmed">
              {row.description}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) => (
        <RowActionsMenu name={row.title}>
          <Menu.Item color="red" onClick={() => removeWithUndo(row)}>
            Remove task
          </Menu.Item>
        </RowActionsMenu>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="sm">
          <TextInput
            {...register('title')}
            label="Task"
            placeholder="Collect your laptop from IT"
            required
            autoComplete="off"
            error={errors.title?.message}
          />
          <TextInput
            {...register('description')}
            label="Details"
            description="Optional — where to go or who to ask."
            autoComplete="off"
            error={errors.description?.message}
          />
          <Group justify="flex-end">
            <Button type="submit">Add task</Button>
          </Group>
        </Stack>
      </form>

      <DataTable
        label="First-day tasks"
        columns={columns}
        rows={tasks}
        rowKey={(row) => row.id}
        isPending={false}
        minWidth={420}
        empty={
          <EmptyState
            title="No first-day tasks yet"
            description="Add what every new hire should get done in their first days, such as collecting a laptop or meeting their lead."
          />
        }
      />
    </Stack>
  )
}
