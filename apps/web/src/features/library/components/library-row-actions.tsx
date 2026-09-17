'use client'

import { ActionIcon, Menu } from '@mantine/core'
import { IconDots, IconDownload, IconPencil, IconTrash } from '@tabler/icons-react'
import type { LibraryEntry } from '../schema'

export interface LibraryRowActionsProps {
  entry: LibraryEntry
  onDownload: () => void
  onRename: () => void
  onDelete: () => void
}

export function LibraryRowActions({ entry, ...on }: LibraryRowActionsProps) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${entry.name}`}>
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {entry.isFolder ? null : (
          <Menu.Item leftSection={<IconDownload size={16} />} onClick={on.onDownload}>
            Download
          </Menu.Item>
        )}
        <Menu.Item leftSection={<IconPencil size={16} />} onClick={on.onRename}>
          Rename
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={on.onDelete}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
