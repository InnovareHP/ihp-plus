'use client'

import { Drawer } from '@mantine/core'
import type { TeamRow } from '../schema'
import { TeamMembersBody } from './team-members-body'

export interface TeamMembersDrawerProps {
  team: TeamRow | undefined
  onClose: () => void
}

export function TeamMembersDrawer({ team, onClose }: TeamMembersDrawerProps) {
  return (
    <Drawer
      opened={Boolean(team)}
      onClose={onClose}
      position="right"
      size="md"
      title={team ? team.name : 'Department'}
    >
      {team ? <TeamMembersBody team={team} /> : null}
    </Drawer>
  )
}
