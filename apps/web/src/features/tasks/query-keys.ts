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
  activity: (taskId: string) => [...taskKeys.all, 'activity', taskId] as const,
  conversation: (taskId: string) => [...taskKeys.all, 'conversation', taskId] as const,
}
