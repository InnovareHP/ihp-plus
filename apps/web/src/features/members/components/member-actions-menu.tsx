'use client'

import { Box, Menu } from '@mantine/core'
import { IconBriefcase, IconLogin2, IconUserCheck, IconUserOff } from '@tabler/icons-react'
import { RowActionsMenu } from '@/components/row-actions-menu'

export interface MemberActionsMenuProps {
  name: string
  banned: boolean
  canSuspend: boolean
  canSignInAs: boolean
  isSigningIn: boolean
  onToggleBanned: () => void
  onSignInAs: () => void
  /** Opens shift, pay and status, which a phone's card leaves out. */
  onEditWorkDetails?: () => void
}

export function MemberActionsMenu({
  name,
  banned,
  canSuspend,
  canSignInAs,
  isSigningIn,
  onToggleBanned,
  onSignInAs,
  onEditWorkDetails,
}: MemberActionsMenuProps) {
  if (!canSuspend && !canSignInAs && !onEditWorkDetails) return null
  // A row whose only action is the phone one carries no menu on wider screens, where it would be empty.
  const phoneOnly = !canSuspend && !canSignInAs

  const menu = (
    <RowActionsMenu name={name}>
      {/* Phones only: wider screens edit these right in the row. */}
      {onEditWorkDetails ? (
        <Menu.Item
          hiddenFrom="sm"
          leftSection={<IconBriefcase size={14} aria-hidden />}
          onClick={onEditWorkDetails}
        >
          Edit shift, pay and status
        </Menu.Item>
      ) : null}
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
            banned ? <IconUserCheck size={14} aria-hidden /> : <IconUserOff size={14} aria-hidden />
          }
          color={banned ? undefined : 'red'}
          onClick={onToggleBanned}
        >
          {banned ? 'Restore access' : 'Suspend'}
        </Menu.Item>
      ) : null}
    </RowActionsMenu>
  )

  return phoneOnly ? <Box hiddenFrom="sm">{menu}</Box> : menu
}
