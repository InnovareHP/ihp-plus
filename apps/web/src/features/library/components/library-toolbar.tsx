'use client'

import { Button, FileButton, Group } from '@mantine/core'
import { IconFolderPlus, IconUpload } from '@tabler/icons-react'

export interface LibraryToolbarProps {
  isUploading: boolean
  onUpload: (files: File[]) => void
  onNewFolder: () => void
}

export function LibraryToolbar({ isUploading, onUpload, onNewFolder }: LibraryToolbarProps) {
  return (
    <Group gap="sm" wrap="wrap">
      {/* The visible control is the button; the input it drives still needs its own name. */}
      <FileButton multiple onChange={onUpload} inputProps={{ 'aria-label': 'Upload files' }}>
        {(props) => (
          <Button {...props} leftSection={<IconUpload size={16} />} loading={isUploading}>
            {isUploading ? 'Uploading…' : 'Upload files'}
          </Button>
        )}
      </FileButton>
      <Button variant="default" leftSection={<IconFolderPlus size={16} />} onClick={onNewFolder}>
        New folder
      </Button>
    </Group>
  )
}
