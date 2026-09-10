import type { EventName } from '@/lib/analytics'

export const memberEvents = {
  roleChanged: 'members.member.role_changed',
  roleChangeFailed: 'members.member.role_change_failed',
  banToggled: 'members.member.ban_toggled',
  banToggleFailed: 'members.member.ban_toggle_failed',
} as const satisfies Record<string, EventName>
