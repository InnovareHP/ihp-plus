export const bulletinKeys = {
  all: ['bulletin'] as const,
  feeds: () => [...bulletinKeys.all, 'feed'] as const,
  feed: (limit: number) => [...bulletinKeys.feeds(), limit] as const,
  comments: (postId: string) => [...bulletinKeys.all, 'comments', postId] as const,
  acknowledgements: (postId: string) => [...bulletinKeys.all, 'acknowledgements', postId] as const,
  people: () => [...bulletinKeys.all, 'people'] as const,
  settings: () => [...bulletinKeys.all, 'settings'] as const,
}
