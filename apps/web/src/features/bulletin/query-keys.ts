export const bulletinKeys = {
  all: ['bulletin'] as const,
  feeds: () => [...bulletinKeys.all, 'feed'] as const,
  feed: (limit: number) => [...bulletinKeys.feeds(), limit] as const,
  comments: (postId: string) => [...bulletinKeys.all, 'comments', postId] as const,
}
