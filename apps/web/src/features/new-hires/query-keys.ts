export const newHireKeys = {
  all: ['new-hires'] as const,
  mine: () => [...newHireKeys.all, 'mine'] as const,
  list: () => [...newHireKeys.all, 'list'] as const,
  setup: () => [...newHireKeys.all, 'setup'] as const,
}
