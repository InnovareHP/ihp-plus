'use client'

import { Button, Stack, Text } from '@mantine/core'
import { usePathname } from 'next/navigation'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { formatBytes } from '@/lib/file-look'
import { routes } from '@/lib/routes'
import { useLibraryFolder, useOpenLibraryFile } from '../hooks/use-library'
import { libraryHref, useLibraryQuery } from '../hooks/use-library-query'
import type { LibraryEntry, LibrarySortKey } from '../schema'
import { parentLibraryPath } from '../utils/library-path'
import { LibraryEntryName } from './library-entry-name'
import { LibraryTrail } from './library-trail'

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export function LibraryBrowser() {
  // usePathname drops the basePath, which is exactly what next/link expects back.
  const pathname = usePathname() || routes.library
  const { query, setQuery } = useLibraryQuery()
  const folder = useLibraryFolder(query)
  const open = useOpenLibraryFile()

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
      width: 120,
      render: (entry) =>
        entry.isFolder ? null : (
          <Button
            variant="subtle"
            size="compact-sm"
            loading={open.isPending && open.variables === entry.id}
            onClick={() => open.mutate(entry.id)}
          >
            Open
          </Button>
        ),
    },
  ]

  return (
    <Stack gap="md">
      <LibraryTrail pathname={pathname} query={query} />

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
            description="Anything staff add to it in SharePoint shows up here."
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
    </Stack>
  )
}
