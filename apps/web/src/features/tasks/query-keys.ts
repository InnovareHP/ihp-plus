import type { TaskQuery } from './schema'

export const taskKeys = {
  all: ['tasks'] as const,
  projects: (includeArchived: boolean) => [...taskKeys.all, 'projects', includeArchived] as const,
  lists: (projectId: string) => [...taskKeys.all, 'lists', projectId] as const,
  statuses: () => [...taskKeys.all, 'statuses'] as const,
  board: (query: TaskQuery) => [...taskKeys.all, 'board', query] as const,
  boards: () => [...taskKeys.all, 'board'] as const,
  mentions: (includeRead: boolean) => [...taskKeys.all, 'mentions', includeRead] as const,
  mentionFeeds: () => [...taskKeys.all, 'mentions'] as const,
  timeSettings: () => [...taskKeys.all, 'time-settings'] as const,
  timeLog: (taskId: string) => [...taskKeys.all, 'time-log', taskId] as const,
  runningTimer: () => [...taskKeys.all, 'running-timer'] as const,
  detail: (taskId: string) => [...taskKeys.all, 'detail', taskId] as const,
  activity: (taskId: string) => [...taskKeys.all, 'activity', taskId] as const,
  conversation: (taskId: string) => [...taskKeys.all, 'conversation', taskId] as const,
}
