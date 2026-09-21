'use client'

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { track, type EventName } from '@/lib/analytics'
import { announceFailure } from '@/lib/announce'
import { taskEvents } from '../events'
import { taskKeys } from '../query-keys'
import { completeTask, createTask, deleteTask, listTasks, reorderTask, updateTask } from '../rpc'
import type {
  ReorderTaskValues,
  TaskFormValues,
  TaskQuery,
  TaskRow,
  TaskStatusRow,
  UpdateTaskValues,
} from '../schema'

export function useTaskBoard(query: TaskQuery, enabled: boolean) {
  return useQuery({
    queryKey: taskKeys.board(query),
    queryFn: () => listTasks(query),
    enabled,
    // A filtered board must not blank out while the next filter loads.
    placeholderData: (previous) => previous,
  })
}

interface BoardMutationOptions<TVariables> {
  mutationFn: (variables: TVariables) => Promise<unknown>
  /** `query` is the board being patched: a create only belongs on the boards that would list it. */
  apply: (rows: readonly TaskRow[], variables: TVariables, query: TaskQuery) => TaskRow[]
  successEvent: EventName
  failureEvent: EventName
}

/**
 * Every board CRUD writes into each cached board — the same task sits in the "everyone" board
 * and in the filtered one the user is looking at — and restores that exact snapshot on failure.
 */
function useBoardMutation<TVariables>(options: BoardMutationOptions<TVariables>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: TVariables) => {
      // An in-flight refetch would land on top of the optimistic board.
      await queryClient.cancelQueries({ queryKey: taskKeys.boards() })
      const previous: [QueryKey, TaskRow[] | undefined][] = queryClient.getQueriesData<TaskRow[]>({
        queryKey: taskKeys.boards(),
      })

      for (const [key, rows] of previous) {
        const query = key[2] as TaskQuery | undefined
        if (!rows || !query) continue
        queryClient.setQueryData<TaskRow[]>(key, options.apply(rows, variables, query))
      }

      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      for (const [key, rows] of context?.previous ?? []) {
        queryClient.setQueryData(key, rows)
      }
      track(options.failureEvent, { reason: error.message })
      announceFailure(error.message)
    },
    onSuccess: () => {
      track(options.successEvent)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

interface CreateTaskContext {
  values: TaskFormValues
  statuses: readonly TaskStatusRow[]
  people: ReadonlyMap<string, string>
}

export function useCreateTask() {
  return useBoardMutation<CreateTaskContext>({
    mutationFn: ({ values }) => createTask(values),
    apply: (rows, { values, statuses, people }, query) => {
      // A board filtered to another project, another list, or to someone else's work would not
      // list this task, so it must not grow a row that vanishes on the next refetch.
      if (query.projectId !== values.projectId) return [...rows]
      if (query.listId && query.listId !== values.listId) return [...rows]
      if (query.assignee === 'mine' && values.assigneeIds.length === 0) return [...rows]
      if (query.assignee === 'unassigned' && values.assigneeIds.length > 0) return [...rows]
      if (query.search && !values.name.toLowerCase().includes(query.search.toLowerCase())) {
        return [...rows]
      }

      const status = statuses.find((candidate) => candidate.category === 'active')
      if (!status) return [...rows]

      const now = new Date().toISOString()
      const last = rows.reduce((max, row) => Math.max(max, row.position), 0)
      const pending: TaskRow = {
        // Replaced by the server's id on settle; never a list index.
        id: crypto.randomUUID(),
        taskNumber: 0,
        name: values.name,
        description: values.description,
        priority: values.priority,
        projectId: values.projectId,
        listId: values.listId,
        statusId: status.id,
        status,
        assignees: values.assigneeIds.map((userId) => ({
          userId,
          name: people.get(userId) ?? 'Teammate',
        })),
        startDate: undefined,
        dueDate: values.dueDate || undefined,
        completedAt: undefined,
        isArchived: false,
        position: last + 1024,
        createdAt: now,
        updatedAt: now,
        commentCount: 0,
        attachmentCount: 0,
        parentId: undefined,
        subtasks: [],
      }

      return [...rows, pending]
    },
    successEvent: taskEvents.created,
    failureEvent: taskEvents.createFailed,
  })
}

interface UpdateTaskContext extends UpdateTaskValues {
  /** Resolved by the caller so the row can show the new status before the server answers. */
  status?: TaskStatusRow
  assignees?: readonly { userId: string; name: string }[]
}

export function useUpdateTask() {
  return useBoardMutation<UpdateTaskContext>({
    mutationFn: (values) => updateTask(values),
    apply: (rows, values) =>
      rows.map((row) =>
        row.id === values.taskId
          ? {
              ...row,
              ...(values.name === undefined ? {} : { name: values.name }),
              ...(values.description === undefined ? {} : { description: values.description }),
              ...(values.priority === undefined ? {} : { priority: values.priority }),
              ...(values.dueDate === undefined ? {} : { dueDate: values.dueDate || undefined }),
              ...(values.isArchived === undefined ? {} : { isArchived: values.isArchived }),
              ...(values.status ? { status: values.status, statusId: values.status.id } : {}),
              ...(values.assignees ? { assignees: [...values.assignees] } : {}),
            }
          : row,
      ),
    successEvent: taskEvents.updated,
    failureEvent: taskEvents.updateFailed,
  })
}

interface CompleteTaskContext {
  taskId: string
  completed: boolean
  /** The organization's done and active statuses, so the row repaints instantly. */
  statuses: readonly TaskStatusRow[]
}

export function useCompleteTask() {
  return useBoardMutation<CompleteTaskContext>({
    mutationFn: ({ taskId, completed }) => completeTask(taskId, completed),
    apply: (rows, { taskId, completed, statuses }) => {
      const next = statuses.find((status) => status.category === (completed ? 'done' : 'active'))
      return rows.map((row) =>
        row.id === taskId
          ? {
              ...row,
              status: next ?? row.status,
              statusId: next?.id ?? row.statusId,
              completedAt: completed ? new Date().toISOString() : undefined,
            }
          : row,
      )
    },
    successEvent: taskEvents.completed,
    failureEvent: taskEvents.completeFailed,
  })
}

interface CreateSubtaskContext {
  parent: TaskRow
  name: string
}

export function useCreateSubtask() {
  return useBoardMutation<CreateSubtaskContext>({
    mutationFn: ({ parent, name }) =>
      createTask({
        projectId: parent.projectId,
        listId: parent.listId,
        name,
        description: '',
        priority: 'normal',
        dueDate: '',
        assigneeIds: [],
        parentId: parent.id,
      }),
    apply: (rows, { parent, name }) =>
      rows.map((row) =>
        row.id === parent.id
          ? {
              ...row,
              subtasks: [
                ...row.subtasks,
                {
                  // Replaced by the server's id on settle; never a list index.
                  id: crypto.randomUUID(),
                  name,
                  isDone: false,
                  position:
                    row.subtasks.reduce((max, one) => Math.max(max, one.position), 0) + 1024,
                },
              ],
            }
          : row,
      ),
    successEvent: taskEvents.subtaskCreated,
    failureEvent: taskEvents.subtaskCreateFailed,
  })
}

export function useCompleteSubtask() {
  return useBoardMutation<{ subtaskId: string; completed: boolean }>({
    mutationFn: ({ subtaskId, completed }) => completeTask(subtaskId, completed),
    apply: (rows, { subtaskId, completed }) =>
      rows.map((row) => ({
        ...row,
        subtasks: row.subtasks.map((one) =>
          one.id === subtaskId ? { ...one, isDone: completed } : one,
        ),
      })),
    successEvent: taskEvents.subtaskCompleted,
    failureEvent: taskEvents.subtaskCompleteFailed,
  })
}

export function useDeleteSubtask() {
  return useBoardMutation<{ subtaskId: string }>({
    mutationFn: ({ subtaskId }) => deleteTask(subtaskId),
    apply: (rows, { subtaskId }) =>
      rows.map((row) => ({
        ...row,
        subtasks: row.subtasks.filter((one) => one.id !== subtaskId),
      })),
    successEvent: taskEvents.subtaskDeleted,
    failureEvent: taskEvents.subtaskDeleteFailed,
  })
}

export function useReorderTask() {
  return useBoardMutation<ReorderTaskValues>({
    mutationFn: (values) => reorderTask(values),
    apply: (rows, values) => {
      const moving = rows.find((row) => row.id === values.taskId)
      if (!moving) return [...rows]

      const rest = rows.filter((row) => row.id !== values.taskId)
      const moved = { ...moving, listId: values.listId }
      if (!values.beforeTaskId) return [...rest, moved]

      const index = rest.findIndex((row) => row.id === values.beforeTaskId)
      if (index === -1) return [...rest, moved]

      return [...rest.slice(0, index), moved, ...rest.slice(index)]
    },
    successEvent: taskEvents.reordered,
    failureEvent: taskEvents.reorderFailed,
  })
}

export function useDeleteTask() {
  return useBoardMutation<{ taskId: string }>({
    mutationFn: ({ taskId }) => deleteTask(taskId),
    apply: (rows, { taskId }) => rows.filter((row) => row.id !== taskId),
    successEvent: taskEvents.deleted,
    failureEvent: taskEvents.deleteFailed,
  })
}
