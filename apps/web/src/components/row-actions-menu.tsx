'use client'

import { ActionIcon, Menu } from '@mantine/core'
import { IconDotsVertical } from '@tabler/icons-react'
import type { ReactNode } from 'react'

export interface RowActionsMenuProps {
  /** What the row is, so the trigger reads "Actions for Acme Corp" rather than a bare icon. */
  name: string
  /** A row action still running, shown on the trigger since the menu has closed by then. */
  loading?: boolean
  /** `Menu.Item`s. */
  children: ReactNode
}

/** Every table's row actions sit behind one three-dot trigger, so no Actions column wraps. */
export function RowActionsMenu({ name, loading, children }: RowActionsMenuProps) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          loading={loading}
          aria-label={`Actions for ${name}`}
        >
          <IconDotsVertical size={16} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  )
}
