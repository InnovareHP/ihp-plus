'use client'

import { Menu } from '@mantine/core'
import { IconDownload, IconEye, IconPencil, IconTrash } from '@tabler/icons-react'
import { RowActionsMenu } from '@/components/row-actions-menu'
import type { LibraryEntry } from '../schema'
import { libraryFileUrl } from '../utils/library-file'

export interface LibraryRowActionsProps {
  entry: LibraryEntry
  /** Set for an image, which the portal can show without a download. */
  onPreview?: () => void
  onDownload: () => void
  onRename: () => void
  onDelete: () => void
}

export function LibraryRowActions({ entry, ...on }: LibraryRowActionsProps) {
  return (
    <RowActionsMenu name={entry.name}>
      {on.onPreview ? (
        <Menu.Item leftSection={<IconEye size={16} />} onClick={on.onPreview}>
          Preview
        </Menu.Item>
      ) : null}
      {entry.isFolder ? null : (
        <Menu.Item
          component="a"
          href={libraryFileUrl(entry, 'original', { download: true })}
          leftSection={<IconDownload size={16} />}
          onClick={on.onDownload}
        >
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
