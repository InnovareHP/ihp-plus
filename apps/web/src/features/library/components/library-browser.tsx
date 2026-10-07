'use client'

import { Button, Group, Stack, Text } from '@mantine/core'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { announceFailure } from '@/lib/announce'
import { formatBytes } from '@/lib/file-look'
import { routes } from '@/lib/routes'
import { track } from '@/lib/analytics'
import { useClientPagination } from '@/lib/use-client-pagination'
import { useUrlQueryParam } from '@/lib/use-url-query-param'
import { libraryEvents } from '../events'
import {
  useCreateLibraryFolder,
  useDeleteLibraryItem,
  useLibraryFolder,
  useRenameLibraryItem,
  useUploadsInFlight,
  useUploadToLibrary,
} from '../hooks/use-library'
import { libraryHref, useLibraryQuery } from '../hooks/use-library-query'
import type { LibraryEntry, LibrarySortKey } from '../schema'
import { isPreviewableImage } from '../utils/library-file'
import { LIBRARY_ROOT_LABEL, parentLibraryPath } from '../utils/library-path'
import { uploadsFromDrop, uploadsFromFiles, type LibraryUpload } from '../utils/upload-tree'
import { DeleteItemModal } from './delete-item-modal'
import { ImagePreviewModal } from './image-preview-modal'
import { LibraryDropZone } from './library-drop-zone'
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
  const upload = useUploadToLibrary(query)
  const uploadsLeft = useUploadsInFlight()
  // The open picture is a deep link of its own, so a shared URL lands on it.
  const preview = useUrlQueryParam('preview', 0)
  const createFolder = useCreateLibraryFolder(query)
  const rename = useRenameLibraryItem(query)
  const remove = useDeleteLibraryItem(query)

  const paged = useClientPagination(folder.data?.entries)

  const [isNewFolderOpen, setNewFolderOpen] = useState(false)
  const [renaming, setRenaming] = useState<LibraryEntry | null>(null)
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null)

  const folderLabel = query.path || LIBRARY_ROOT_LABEL
  const images = (folder.data?.entries ?? []).filter((entry) =>
    isPreviewableImage(entry.contentType),
  )

  const uploadAll = (uploads: LibraryUpload[]) => uploads.forEach((item) => upload.mutate(item))
  const openPreview = (entry: LibraryEntry) => {
    track(libraryEvents.previewed)
    preview.commit(entry.id)
  }
  const previewOf = (entry: LibraryEntry) =>
    isPreviewableImage(entry.contentType) ? () => openPreview(entry) : undefined

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
          onPreview={previewOf(entry)}
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
      width: 90,
      render: (entry) => (
        <LibraryRowActions
          entry={entry}
          onPreview={previewOf(entry)}
          onDownload={() => track(libraryEvents.opened)}
          onRename={() => setRenaming(entry)}
          onDelete={() => setDeleting(entry)}
        />
      ),
    },
  ]

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <LibraryTrail pathname={pathname} query={query} />
        <LibraryToolbar
          uploadsLeft={uploadsLeft}
          onUpload={(files) => uploadAll(uploadsFromFiles(files))}
          onNewFolder={() => setNewFolderOpen(true)}
        />
      </Group>

      <LibraryDropZone
        folderLabel={folderLabel}
        onDrop={(transfer) => {
          uploadsFromDrop(transfer).then(uploadAll, () =>
            announceFailure('Could not read what was dropped — try the Upload folder button.'),
          )
        }}
      >
        <DataTable
          label="Internal library"
          columns={columns}
          rows={paged.rows}
          pageInfo={paged.pageInfo}
          onPageChange={paged.onPageChange}
          onPageSizeChange={paged.onPageSizeChange}
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
              description="Drop files or a whole folder here, or add them in SharePoint and they show up here."
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
      </LibraryDropZone>

      {preview.value ? (
        <ImagePreviewModal
          images={images}
          activeId={preview.value}
          onSelect={preview.commit}
          onClose={() => preview.commit('')}
        />
      ) : null}

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
