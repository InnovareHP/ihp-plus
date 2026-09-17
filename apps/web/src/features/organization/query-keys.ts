export const organizationKeys = {
  all: ['organization'] as const,
  summary: () => [...organizationKeys.all, 'summary'] as const,
  teams: () => [...organizationKeys.all, 'teams'] as const,
  teamMembers: (teamId: string) => [...organizationKeys.all, 'teams', teamId, 'members'] as const,
  assignable: () => [...organizationKeys.all, 'assignable'] as const,
  invitations: () => [...organizationKeys.all, 'invitations'] as const,
}
