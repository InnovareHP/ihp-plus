export const searchKeys = {
  all: ['search'] as const,
  directory: () => [...searchKeys.all, 'directory'] as const,
}
