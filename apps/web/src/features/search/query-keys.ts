export const searchKeys = {
  all: ['search'] as const,
  directory: () => [...searchKeys.all, 'directory'] as const,
  taskQueries: () => [...searchKeys.all, 'tasks'] as const,
  tasks: (query: string) => [...searchKeys.taskQueries(), query] as const,
}
