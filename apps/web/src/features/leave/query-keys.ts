import type { LeavePreviewInput } from './schema'

export const leaveKeys = {
  all: ['leave'] as const,
  mine: (year: number | undefined) => [...leaveKeys.all, 'mine', year ?? 'current'] as const,
  teams: () => [...leaveKeys.all, 'team'] as const,
  team: (year: number | undefined) => [...leaveKeys.teams(), year ?? 'current'] as const,
  preview: (input: LeavePreviewInput) => [...leaveKeys.all, 'preview', input] as const,
}
