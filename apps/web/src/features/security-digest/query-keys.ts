export const digestKeys = {
  all: ['security-digest'] as const,
  overview: () => [...digestKeys.all, 'overview'] as const,
}
