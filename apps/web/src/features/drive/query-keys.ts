export const driveKeys = {
  all: ['drive'] as const,
  // Who can open one client's folder; the folder itself is Graph's, not ours to cache.
  access: (clientId: string) => [...driveKeys.all, 'access', clientId] as const,
}
