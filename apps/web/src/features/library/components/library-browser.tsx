'use client'

import { Button, Group, Stack, Text } from '@mantine/core'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { formatBytes } from '@/lib/file-look'
import { routes } from '@/lib/routes'
import {
  useCreateLibraryFolder,
  useDeleteLibraryItem,
  useLibraryFolder,
  useOpenLibraryFile,
  useRenameLibraryItem,
  useUploadToLibrary,
} from '../hooks/use-library'
import { libraryHref, useLibraryQuery } from '../hooks/use-library-query'
import type { LibraryEntry, LibrarySortKey } from '../schema'
import { LIBRARY_ROOT_LABEL, parentLibraryPath } from '../utils/library-path'
import { DeleteItemModal } from './delete-item-modal'
import { LibraryEntryName } from './library-entry-name'
import { LibraryRowActions } from './library-row-actions'
import { LibraryToolbar } from './library-toolbar'
import { LibraryTrail } from './library-trail'
import { NewFolderModal } from './new-folder-modal'
import { RenameItemModal } from './rename-item-modal'

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export function LibraryBrowser() {
  // usePathname drops the basePath, which is exactly what next/link expects back.
  const pathname = usePathname() || routes.library
  const { query, setQuery } = useLibraryQuery()
  const folder = useLibraryFolder(query)
  const open = useOpenLibraryFile()
  const upload = useUploadToLibrary(query)
  const createFolder = useCreateLibraryFolder(query)
  const rename = useRenameLibraryItem(query)
  const remove = useDeleteLibraryItem(query)

  const [isNewFolderOpen, setNewFolderOpen] = useState(false)
  const [renaming, setRenaming] = useState<LibraryEntry | null>(null)
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null)

  const folderLabel = query.path || LIBRARY_ROOT_LABEL

  const columns: DataTableColumn<LibraryEntry>[] = [
    {
      key: 'name',
      header: 'Name',
      rowHeader: true,
      sortable: true,
      render: (entry) => (
        <LibraryEntryName
          entry={entry}
          href={entry.isFolder ? libraryHref(pathname, { ...query, path: entry.path }) : undefined}
        />
      ),
    },
    {
      key: 'lastModifiedAt',
      header: 'Modified',
      sortable: true,
      render: (entry) => (
        <Text size="sm">
          {entry.lastModifiedAt ? stamp.format(new Date(entry.lastModifiedAt)) : '—'}
        </Text>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      align: 'right',
      sortable: true,
      width: 120,
      render: (entry) => (
        <Text size="sm" c={entry.isFolder ? 'dimmed' : undefined}>
          {entry.isFolder
            ? `${entry.childCount ?? 0} item${entry.childCount === 1 ? '' : 's'}`
            : formatBytes(entry.size ?? 0)}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 140,
      render: (entry) => (
        <Group gap="xs" justify="flex-end" wrap="nowrap">
          {entry.isFolder ? null : (
            <Button
              variant="subtle"
              size="compact-sm"
              loading={open.isPending && open.variables === entry.id}
              onClick={() => open.mutate(entry.id)}
            >
              Download
            </Button>
          )}
          <LibraryRowActions
            entry={entry}
            onDownload={() => open.mutate(entry.id)}
            onRename={() => setRenaming(entry)}
            onDelete={() => setDeleting(entry)}
          />
        </Group>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <LibraryTrail pathname={pathname} query={query} />
        <LibraryToolbar
          isUploading={upload.isPending}
          onUpload={(files) => files.forEach((file) => upload.mutate(file))}
          onNewFolder={() => setNewFolderOpen(true)}
        />
      </Group>

      <DataTable
        label="Internal library"
        columns={columns}
        rows={folder.data?.entries}
        rowKey={(entry) => entry.id}
        isPending={folder.isPending}
        isError={folder.isError}
        isFetching={folder.isFetching}
        error={folder.error}
        errorTitle="Could not open that folder"
        onRetry={() => folder.refetch()}
        density="comfortable"
        empty={
          <EmptyState
            title="This folder is empty"
            description="Upload a file, or add one in SharePoint and it shows up here."
            action={
              query.path ? (
                <Button
                  variant="default"
                  onClick={() => setQuery({ path: parentLibraryPath(query.path) })}
                >
                  Go up one folder
                </Button>
              ) : undefined
            }
          />
        }
        sort={{ key: query.sortBy, direction: query.sortDirection }}
        onSortChange={({ key, direction }) =>
          setQuery({ sortBy: key as LibrarySortKey, sortDirection: direction })
        }
      />

      <NewFolderModal
        opened={isNewFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        folderLabel={folderLabel}
        onCreate={(name) => createFolder.mutateAsync(name).then(() => undefined)}
      />

      <RenameItemModal
        entry={renaming}
        onClose={() => setRenaming(null)}
        onRename={(name) =>
          rename.mutateAsync({ itemId: renaming?.id ?? '', name }).then(() => undefined)
        }
      />

      <DeleteItemModal
        entry={deleting}
        isPending={remove.isPending}
        onClose={() => setDeleting(null)}
        onDelete={() => {
          if (deleting) remove.mutate({ itemId: deleting.id, name: deleting.name })
          setDeleting(null)
        }}
      />
    </Stack>
  )
}
