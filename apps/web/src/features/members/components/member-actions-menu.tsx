'use client'

import { ActionIcon, Menu } from '@mantine/core'
import { IconDotsVertical, IconLogin2, IconUserCheck, IconUserOff } from '@tabler/icons-react'

export interface MemberActionsMenuProps {
  name: string
  banned: boolean
  canSuspend: boolean
  canSignInAs: boolean
  isSigningIn: boolean
  onToggleBanned: () => void
  onSignInAs: () => void
}

export function MemberActionsMenu({
  name,
  banned,
  canSuspend,
  canSignInAs,
  isSigningIn,
  onToggleBanned,
  onSignInAs,
}: MemberActionsMenuProps) {
  if (!canSuspend && !canSignInAs) return null

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${name}`}>
          <IconDotsVertical size={16} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {canSignInAs ? (
          <Menu.Item
            leftSection={<IconLogin2 size={14} aria-hidden />}
            disabled={isSigningIn}
            onClick={onSignInAs}
          >
            {isSigningIn ? 'Signing in…' : 'Sign in as'}
          </Menu.Item>
        ) : null}
        {canSuspend ? (
          <Menu.Item
            leftSection={
              banned ? (
                <IconUserCheck size={14} aria-hidden />
              ) : (
                <IconUserOff size={14} aria-hidden />
              )
            }
            color={banned ? undefined : 'red'}
            onClick={onToggleBanned}
          >
            {banned ? 'Restore access' : 'Suspend'}
          </Menu.Item>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  )
}
