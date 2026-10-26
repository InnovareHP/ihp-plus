export const draftKeys = {
  all: ['drafts'] as const,
  list: () => [...draftKeys.all, 'list'] as const,
  detail: (draftId: string) => [...draftKeys.all, 'detail', draftId] as const,
}
