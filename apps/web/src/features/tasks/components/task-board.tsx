'use client'

import { Alert, Button, Group, SegmentedControl, Skeleton, Stack, Text } from '@mantine/core'
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
import {
  useDeleteList,
  useTaskLists,
  useTaskProjects,
  useTaskStatuses,
  useUpdateProject,
} from '../hooks/use-task-projects'
import {
  useCompleteTask,
  useCreateTask,
  useRemoveTasks,
  useReorderTask,
  useTaskBoard,
  useTaskDetail,
  useUpdateTask,
} from '../hooks/use-tasks'
import {
  boardQuerySchema,
  DEFAULT_BOARD_QUERY,
  TASK_ASSIGNEE_FILTERS,
  TASK_ASSIGNEE_FILTER_LABELS,
  TASK_DUE_FILTERS,
  TASK_DUE_FILTER_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
  type TaskFormValues,
  type TaskListRow,
  type TaskProjectRow,
  type TaskRow,
} from '../schema'
import { DeleteListModal } from './delete-list-modal'
import { TaskDetailModal } from './task-detail-modal'
import { TaskKanban } from './task-kanban'
import { ListFormModal } from './list-form-modal'
import { ProjectFormModal } from './project-form-modal'
import { ProjectSelect } from './project-select'
import { StatusManagerModal } from './status-manager-modal'
import { TaskFormModal } from './task-form-modal'
import { TaskListSection } from './task-list-section'
import { TaskSelectionBar } from './task-selection-bar'
import { TaskStats } from './task-stats'

// `priority` arrives as ?priority=urgent,high, so the parser is told it holds a list.
const parseBoardQuery = searchParamsParser(boardQuerySchema, ['priority'])

const STATIC_FILTERS: readonly FilterControl[] = [
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
    kind: 'multi',
    key: 'priority',
    label: 'Priority',
    options: TASK_PRIORITIES.map((priority) => ({
      value: priority,
      label: TASK_PRIORITY_LABELS[priority],
    })),
  },
  {
    kind: 'select',
    key: 'due',
    label: 'Due',
    options: TASK_DUE_FILTERS.filter((filter) => filter !== 'any').map((filter) => ({
      value: filter,
      label: TASK_DUE_FILTER_LABELS[filter],
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
  const [columnsOpened, columnsModal] = useDisclosure(false)
  const [renamingProject, setRenamingProject] = useState<TaskProjectRow | null>(null)
  const [renamingList, setRenamingList] = useState<TaskListRow | null>(null)
  const [deletingList, setDeletingList] = useState<TaskListRow | null>(null)
  const [composing, setComposing] = useState<{ list: TaskListRow; task: TaskRow | null } | null>(
    null,
  )
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

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
      assigneeUserId: query.person || undefined,
      statusId: query.status || undefined,
      priorities: query.priority,
      due: query.due,
    },
    Boolean(projectId),
  )
  const tasks = useMemo(() => board.data ?? [], [board.data])

  const create = useCreateTask()
  const update = useUpdateTask()
  const complete = useCompleteTask()
  const reorder = useReorderTask()
  const remove = useRemoveTasks()
  const archiveProject = useUpdateProject()
  const removeList = useDeleteList()

  const people = useMemo(
    () => (candidates.data ?? []).map((person) => ({ value: person.userId, label: person.name })),
    [candidates.data],
  )

  // Person and column are the organization's own rows, so those two filters are built from data.
  const filters = useMemo<readonly FilterControl[]>(
    () => [
      ...STATIC_FILTERS,
      {
        kind: 'select',
        key: 'person',
        label: 'Person',
        options: people,
      },
      {
        kind: 'select',
        key: 'status',
        label: 'Column',
        options: statusRows.map((status) => ({ value: status.id, label: status.name })),
      },
    ],
    [people, statusRows],
  )

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.value, person.label])),
    [people],
  )

  const boardTask = useMemo(
    () => tasks.find((task) => task.id === query.task) ?? null,
    [tasks, query.task],
  )

  // A subtask, or a task the current filters hide, is still a link somebody can follow.
  const fetchedTask = useTaskDetail(query.task, Boolean(query.task) && !boardTask)
  const openTask = boardTask ?? fetchedTask.data ?? null

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

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selected.has(task.id)),
    [tasks, selected],
  )

  function toggleSelected(task: TaskRow, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (isSelected) next.add(task.id)
      else next.delete(task.id)
      return next
    })
  }

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
      startDate: values.startDate,
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
        startDate: composing.task.startDate ? composing.task.startDate.slice(0, 10) : '',
        dueDate: composing.task.dueDate ? composing.task.dueDate.slice(0, 10) : '',
        assigneeIds: composing.task.assignees.map((assignee) => assignee.userId),
        parentId: '',
      }
    : {
        projectId,
        listId: composing?.list.id ?? listRows[0]?.id ?? '',
        name: '',
        description: '',
        priority: 'normal',
        startDate: '',
        dueDate: '',
        assigneeIds: [],
        parentId: '',
      }

  return (
    <Stack gap="lg">
      <ProjectSelect
        projects={projectRows}
        value={projectId}
        onChange={(next) => setQuery({ project: next, list: '' })}
        onCreate={projectModal.open}
        onRename={setRenamingProject}
        onArchive={(project, archived) =>
          archiveProject.mutate({ projectId: project.id, isArchived: archived })
        }
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
            filters={filters}
            action={
              <Group gap="sm">
                {/* A background refresh dims rather than replaces: only a first load blanks a board. */}
                {board.isFetching && !board.isPending ? (
                  <Text size="xs" c="dimmed" aria-hidden>
                    Updating…
                  </Text>
                ) : null}
                <Button variant="default" onClick={columnsModal.open}>
                  Columns
                </Button>
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
              onMoveTo={(task, statusId) =>
                update.mutate({
                  taskId: task.id,
                  statusId,
                  status: statusRows.find((row) => row.id === statusId),
                })
              }
              onReorder={(task, statusId, beforeTaskId) =>
                reorder.mutate({
                  taskId: task.id,
                  listId: task.listId,
                  beforeTaskId,
                  statusId,
                  status: statusRows.find((row) => row.id === statusId),
                })
              }
              onEdit={(task) => {
                const list = listRows.find((row) => row.id === task.listId)
                if (list) setComposing({ list, task })
              }}
              onDelete={(task) => void remove.remove([task])}
            />
          ) : null}

          {!board.isError && query.view === 'list'
            ? listRows.map((list) => (
                <TaskListSection
                  key={list.id}
                  list={list}
                  tasks={tasksByList.get(list.id) ?? []}
                  onAdd={(target) => setComposing({ list: target, task: null })}
                  onRenameList={setRenamingList}
                  onDeleteList={setDeletingList}
                  onOpen={(task) => setQuery({ task: task.id })}
                  onToggleComplete={(task, completed) =>
                    complete.mutate({ taskId: task.id, completed, statuses: statusRows })
                  }
                  onMove={handleMove}
                  onEdit={(task) => {
                    const list = listRows.find((row) => row.id === task.listId)
                    if (list) setComposing({ list, task })
                  }}
                  onDelete={(task) => void remove.remove([task])}
                  selected={selected}
                  onSelect={toggleSelected}
                />
              ))
            : null}

          {query.view === 'list' ? (
            <TaskSelectionBar
              count={selectedTasks.length}
              isBusy={remove.isPending || complete.isPending}
              onComplete={() => {
                for (const task of selectedTasks) {
                  complete.mutate({ taskId: task.id, completed: true, statuses: statusRows })
                }
                setSelected(new Set())
              }}
              onDelete={() => {
                void remove.remove(selectedTasks)
                setSelected(new Set())
              }}
              onClear={() => setSelected(new Set())}
            />
          ) : null}
        </Stack>
      </PageSection>

      <TaskDetailModal
        task={openTask}
        onOpenTask={(taskId) => setQuery({ task: taskId })}
        viewer={viewer}
        colleagues={colleagues}
        onClose={() => setQuery({ task: '' })}
      />

      <ProjectFormModal
        opened={projectOpened || renamingProject !== null}
        project={renamingProject}
        onClose={() => {
          projectModal.close()
          setRenamingProject(null)
        }}
        onCreated={(id) => setQuery({ project: id })}
      />
      <ListFormModal
        opened={listOpened || renamingList !== null}
        list={renamingList}
        onClose={() => {
          listModal.close()
          setRenamingList(null)
        }}
        projectId={projectId}
      />
      <StatusManagerModal
        opened={columnsOpened}
        statuses={statusRows}
        tasks={tasks}
        onClose={columnsModal.close}
      />
      <DeleteListModal
        list={deletingList}
        taskCount={deletingList ? (tasksByList.get(deletingList.id)?.length ?? 0) : 0}
        onCancel={() => setDeletingList(null)}
        onConfirm={(list) => {
          removeList.mutate({ listId: list.id })
          setDeletingList(null)
        }}
      />
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
    </Stack>
  )
}
