export const teamKeys = {
  all: ['teams'] as const,
  leads: () => [...teamKeys.all, 'leads'] as const,
}
