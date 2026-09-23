'use client'

import { Menu } from '@mantine/core'
import { IconDownload, IconPencil, IconTrash } from '@tabler/icons-react'
import { RowActionsMenu } from '@/components/row-actions-menu'
import type { LibraryEntry } from '../schema'

export interface LibraryRowActionsProps {
  entry: LibraryEntry
  isDownloading: boolean
  onDownload: () => void
  onRename: () => void
  onDelete: () => void
}

export function LibraryRowActions({ entry, isDownloading, ...on }: LibraryRowActionsProps) {
  return (
    <RowActionsMenu name={entry.name} loading={isDownloading}>
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
    </RowActionsMenu>
  )
}
