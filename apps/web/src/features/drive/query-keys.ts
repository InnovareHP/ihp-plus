import type { OrganizationAccessQuery } from './schema'

export const driveKeys = {
  all: ['drive'] as const,
  // Who can open one client's folder; the folder itself is Graph's, not ours to cache.
  access: (clientId: string) => [...driveKeys.all, 'access', clientId] as const,
  // Every page and filter combination of the organization-wide view is its own key.
  organization: (query: OrganizationAccessQuery) =>
    [...driveKeys.all, 'organization-access', query] as const,
}
