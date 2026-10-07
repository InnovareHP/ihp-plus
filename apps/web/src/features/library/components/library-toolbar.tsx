'use client'

import { Button, FileButton, Group, Menu } from '@mantine/core'
import {
  IconChevronDown,
  IconFiles,
  IconFolderPlus,
  IconFolderUp,
  IconUpload,
} from '@tabler/icons-react'
import type { ComponentProps } from 'react'

// React types no folder-picker attribute, though every current browser honours it.
const FOLDER_PICKER: ComponentProps<'input'> & { webkitdirectory: string } = {
  'aria-label': 'Upload a folder',
  webkitdirectory: '',
}

export interface LibraryToolbarProps {
  /** Files still uploading; zero when nothing is in flight. */
  uploadsLeft: number
  onUpload: (files: File[]) => void
  onNewFolder: () => void
}

/** One Upload control: a browser dialog picks files or a folder, never both, so it asks which. */
export function LibraryToolbar({ uploadsLeft, onUpload, onNewFolder }: LibraryToolbarProps) {
  // No loading state on the button: it would disable it, and more files may be queued meanwhile.
  const isUploading = uploadsLeft > 0

  return (
    <Group gap="sm" wrap="wrap">
      {/* Kept mounted: each item's file input must outlive the menu closing as the dialog opens. */}
      <Menu position="bottom-start" keepMounted>
        <Menu.Target>
          <Button
            leftSection={<IconUpload size={16} />}
            rightSection={<IconChevronDown size={14} />}
          >
            {isUploading ? `Uploading… ${uploadsLeft} left` : 'Upload'}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {/* The visible control is the item; the input it drives still needs its own name. */}
          <FileButton multiple onChange={onUpload} inputProps={{ 'aria-label': 'Upload files' }}>
            {(props) => (
              <Menu.Item {...props} leftSection={<IconFiles size={16} />}>
                Files
              </Menu.Item>
            )}
          </FileButton>
          <FileButton multiple onChange={onUpload} inputProps={FOLDER_PICKER}>
            {(props) => (
              <Menu.Item {...props} leftSection={<IconFolderUp size={16} />}>
                Folder
              </Menu.Item>
            )}
          </FileButton>
        </Menu.Dropdown>
      </Menu>
      <Button variant="default" leftSection={<IconFolderPlus size={16} />} onClick={onNewFolder}>
        New folder
      </Button>
    </Group>
  )
}
