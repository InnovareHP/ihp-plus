'use client'

import { Button, FileButton, Group } from '@mantine/core'
import { IconFolderPlus, IconFolderUp, IconUpload } from '@tabler/icons-react'
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

export function LibraryToolbar({ uploadsLeft, onUpload, onNewFolder }: LibraryToolbarProps) {
  const isUploading = uploadsLeft > 0

  return (
    <Group gap="sm" wrap="wrap">
      {/* The visible control is the button; the input it drives still needs its own name. */}
      <FileButton multiple onChange={onUpload} inputProps={{ 'aria-label': 'Upload files' }}>
        {(props) => (
          <Button {...props} leftSection={<IconUpload size={16} />} loading={isUploading}>
            {isUploading ? `Uploading… ${uploadsLeft} left` : 'Upload files'}
          </Button>
        )}
      </FileButton>
      <FileButton multiple onChange={onUpload} inputProps={FOLDER_PICKER}>
        {(props) => (
          <Button {...props} variant="default" leftSection={<IconFolderUp size={16} />}>
            Upload folder
          </Button>
        )}
      </FileButton>
      <Button variant="default" leftSection={<IconFolderPlus size={16} />} onClick={onNewFolder}>
        New folder
      </Button>
    </Group>
  )
}
