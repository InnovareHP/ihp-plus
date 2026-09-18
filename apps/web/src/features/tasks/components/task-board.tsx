'use client'

import { Alert, Button, Group, SegmentedControl, Skeleton, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import { PageSection } from '@/components/page-section'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
// The people who can be assigned are the same org list evaluations already fetches; a second
// RPC returning the same rows would only be a second cache to keep warm.
import { useEvaluationCandidates } from '@/features/evaluations/hooks/use-evaluations'
import { useSession } from '@/lib/auth-client'
import { useTaskLists, useTaskProjects, useTaskStatuses } from '../hooks/use-task-projects'
import {
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useReorderTask,
  useTaskBoard,
  useUpdateTask,
} from '../hooks/use-tasks'
import {
  boardQuerySchema,
  DEFAULT_BOARD_QUERY,
  TASK_ASSIGNEE_FILTERS,
  TASK_ASSIGNEE_FILTER_LABELS,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
  type TaskFormValues,
  type TaskListRow,
  type TaskRow,
} from '../schema'
import { DeleteTaskModal } from './delete-task-modal'
import { TaskDetailDrawer } from './task-detail-drawer'
import { TaskKanban } from './task-kanban'
import { ListFormModal } from './list-form-modal'
import { ProjectFormModal } from './project-form-modal'
import { ProjectSelect } from './project-select'
import { TaskFormModal } from './task-form-modal'
import { TaskListSection } from './task-list-section'
import { TaskStats } from './task-stats'

const parseBoardQuery = searchParamsParser(boardQuerySchema)

const BOARD_FILTERS: readonly FilterControl[] = [
  {
    kind: 'select',
    key: 'assignee',
    label: 'Assigned to',
    options: TASK_ASSIGNEE_FILTERS.filter((filter) => filter !== 'all').map((filter) => ({
      value: filter,
      label: TASK_ASSIGNEE_FILTER_LABELS[filter],
    })),
  },
  {
    kind: 'toggle',
    key: 'archived',
    label: 'Include archived tasks',
    help: 'Tasks put aside without being deleted.',
  },
]

export function TaskBoard() {
  const { query, setQuery, clearFilters } = useUrlQuery(parseBoardQuery, DEFAULT_BOARD_QUERY)
  const [projectOpened, projectModal] = useDisclosure(false)
  const [listOpened, listModal] = useDisclosure(false)
  const [composing, setComposing] = useState<{ list: TaskListRow; task: TaskRow | null } | null>(
    null,
  )
  const [deleting, setDeleting] = useState<TaskRow | null>(null)

  const projects = useTaskProjects()
  const projectRows = useMemo(() => projects.data ?? [], [projects.data])
  const projectId = query.project || projectRows[0]?.id || ''

  const lists = useTaskLists(projectId || undefined)
  const listRows = useMemo(() => lists.data ?? [], [lists.data])
  const statuses = useTaskStatuses()
  const statusRows = useMemo(() => statuses.data ?? [], [statuses.data])
  const candidates = useEvaluationCandidates()

  const board = useTaskBoard(
    {
      projectId,
      listId: query.list || undefined,
      assignee: query.assignee,
      search: query.search,
      includeArchived: query.archived,
    },
    Boolean(projectId),
  )
  const tasks = useMemo(() => board.data ?? [], [board.data])

  const create = useCreateTask()
  const update = useUpdateTask()
  const complete = useCompleteTask()
  const reorder = useReorderTask()
  const remove = useDeleteTask()

  const people = useMemo(
    () => (candidates.data ?? []).map((person) => ({ value: person.userId, label: person.name })),
    [candidates.data],
  )

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.value, person.label])),
    [people],
  )

  const openTask = useMemo(
    () => tasks.find((task) => task.id === query.task) ?? null,
    [tasks, query.task],
  )

  const session = useSession()
  const viewer = useMemo(
    () => ({
      userId: session.data?.user.id ?? '',
      name: session.data?.user.name ?? 'You',
    }),
    [session.data?.user.id, session.data?.user.name],
  )

  const colleagues = useMemo(
    () => people.map((person) => ({ userId: person.value, name: person.label })),
    [people],
  )

  const tasksByList = useMemo(() => {
    const grouped = new Map<string, TaskRow[]>()
    for (const task of tasks) {
      grouped.set(task.listId, [...(grouped.get(task.listId) ?? []), task])
    }
    return grouped
  }, [tasks])

  function handleMove(task: TaskRow, direction: 'up' | 'down') {
    const siblings = tasksByList.get(task.listId) ?? []
    const index = siblings.findIndex((row) => row.id === task.id)
    const before = direction === 'up' ? siblings[index - 1] : siblings[index + 2]

    reorder.mutate({
      taskId: task.id,
      listId: task.listId,
      beforeTaskId: before?.id,
    })
  }

  async function handleSave(values: TaskFormValues) {
    const editing = composing?.task
    if (!editing) {
      await create.mutateAsync({ values, statuses: statusRows, people: peopleById })
      return
    }

    await update.mutateAsync({
      taskId: editing.id,
      name: values.name,
      description: values.description,
      priority: values.priority,
      dueDate: values.dueDate,
      assigneeIds: values.assigneeIds,
      assignees: values.assigneeIds.map((userId) => ({
        userId,
        name: peopleById.get(userId) ?? 'Teammate',
      })),
    })

    // The form can move a task to another list; ordering is the reorder call's job.
    if (values.listId !== editing.listId) {
      await reorder.mutateAsync({
        taskId: editing.id,
        listId: values.listId,
        beforeTaskId: undefined,
      })
    }
  }

  if (projects.isPending) {
    return (
      <Stack gap="md" aria-busy="true">
        <Skeleton height={72} />
        <Skeleton height={120} />
        <Skeleton height={240} />
      </Stack>
    )
  }

  if (projects.isError) {
    return (
      <Alert color="red" role="alert" title="Could not load your projects">
        <Stack gap="sm" align="flex-start">
          {projects.error.message}
          <Button variant="default" onClick={() => projects.refetch()}>
            Try again
          </Button>
        </Stack>
      </Alert>
    )
  }

  if (projectRows.length === 0) {
    return (
      <>
        <EmptyState
          title="Start your first project"
          description="A project holds the lists your team works through — onboarding, audits, anything with steps."
          action={<Button onClick={projectModal.open}>New project</Button>}
        />
        <ProjectFormModal
          opened={projectOpened}
          onClose={projectModal.close}
          onCreated={(id) => setQuery({ project: id })}
        />
      </>
    )
  }

  const defaults: TaskFormValues = composing?.task
    ? {
        projectId,
        listId: composing.task.listId,
        name: composing.task.name,
        description: composing.task.description,
        priority: composing.task.priority,
        dueDate: composing.task.dueDate ? composing.task.dueDate.slice(0, 10) : '',
        assigneeIds: composing.task.assignees.map((assignee) => assignee.userId),
      }
    : {
        projectId,
        listId: composing?.list.id ?? listRows[0]?.id ?? '',
        name: '',
        description: '',
        priority: 'normal',
        dueDate: '',
        assigneeIds: [],
      }

  return (
    <Stack gap="lg">
      <ProjectSelect
        projects={projectRows}
        value={projectId}
        onChange={(next) => setQuery({ project: next, list: '' })}
        onCreate={projectModal.open}
      />

      <TaskStats tasks={tasks} />

      <PageSection
        title="Board"
        description="Every list in this project, in the order you set."
        actions={
          <SegmentedControl
            size="sm"
            aria-label="How to show the tasks"
            value={query.view}
            onChange={(next) => setQuery({ view: next as (typeof TASK_VIEWS)[number] })}
            data={TASK_VIEWS.map((view) => ({ value: view, label: TASK_VIEW_LABELS[view] }))}
          />
        }
      >
        <Stack gap="md">
          <TableToolbar
            label="tasks"
            query={query}
            setQuery={setQuery}
            clearFilters={clearFilters}
            filters={BOARD_FILTERS}
            action={
              <Group gap="sm">
                <Button variant="default" onClick={listModal.open}>
                  New list
                </Button>
                <Button
                  leftSection={<IconPlus size={16} aria-hidden />}
                  disabled={listRows.length === 0}
                  onClick={() => {
                    const list = listRows[0]
                    if (list) setComposing({ list, task: null })
                  }}
                >
                  New task
                </Button>
              </Group>
            }
          />

          {board.isError ? (
            <Alert color="red" role="alert" title="Could not load this board">
              <Stack gap="sm" align="flex-start">
                {board.error.message}
                <Button variant="default" onClick={() => board.refetch()}>
                  Try again
                </Button>
              </Stack>
            </Alert>
          ) : null}

          {board.isPending ? (
            <Stack gap="sm" aria-busy="true">
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </Stack>
          ) : null}

          {!board.isPending && !board.isError && tasks.length === 0 && query.search ? (
            <EmptyState
              title="No tasks match that search"
              description="Nothing on this board has that in its name."
              action={
                <Button variant="default" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : null}

          {!board.isError && query.view === 'board' && !board.isPending ? (
            <TaskKanban
              statuses={statusRows}
              tasks={tasks}
              onOpen={(task) => setQuery({ task: task.id })}
              onMoveTo={(task, statusId) => update.mutate({ taskId: task.id, statusId })}
              onEdit={(task) => {
                const list = listRows.find((row) => row.id === task.listId)
                if (list) setComposing({ list, task })
              }}
              onDelete={setDeleting}
            />
          ) : null}

          {!board.isError && query.view === 'list'
            ? listRows.map((list) => (
                <TaskListSection
                  key={list.id}
                  list={list}
                  tasks={tasksByList.get(list.id) ?? []}
                  onAdd={(target) => setComposing({ list: target, task: null })}
                  onToggleComplete={(task, completed) =>
                    complete.mutate({ taskId: task.id, completed, statuses: statusRows })
                  }
                  onMove={handleMove}
                  onEdit={(task) => {
                    const list = listRows.find((row) => row.id === task.listId)
                    if (list) setComposing({ list, task })
                  }}
                  onDelete={setDeleting}
                />
              ))
            : null}
        </Stack>
      </PageSection>

      <TaskDetailDrawer
        task={openTask}
        viewer={viewer}
        colleagues={colleagues}
        onClose={() => setQuery({ task: '' })}
      />

      <ProjectFormModal
        opened={projectOpened}
        onClose={projectModal.close}
        onCreated={(id) => setQuery({ project: id })}
      />
      <ListFormModal opened={listOpened} onClose={listModal.close} projectId={projectId} />
      <TaskFormModal
        opened={Boolean(composing)}
        onClose={() => setComposing(null)}
        title={composing?.task ? 'Edit task' : 'New task'}
        submitLabel={composing?.task ? 'Save changes' : 'Add task'}
        lists={listRows}
        people={people}
        defaults={defaults}
        onSave={handleSave}
      />
      <DeleteTaskModal
        task={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={(task) => {
          remove.mutate({ taskId: task.id })
          setDeleting(null)
        }}
      />
    </Stack>
  )
}
