'use client'

import { Text } from '@mantine/core'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { draftRoute } from '@/lib/routes'
import { describeMoment } from '@/lib/relative-time'
import type { DraftRow } from '../schema'
import { useDrafts } from '../use-drafts'
import { NewContractButton } from './new-contract-button'

const columns: DataTableColumn<DraftRow>[] = [
  {
    key: 'title',
    header: 'Draft',
    rowHeader: true,
    render: (draft) => <Link href={draftRoute(draft.id)}>{draft.title}</Link>,
  },
  {
    key: 'updated',
    header: 'Last edited',
    width: 260,
    render: (draft) => <Text size="sm">{describeMoment(draft.updatedAt)}</Text>,
  },
]

export function DraftsTable() {
  const drafts = useDrafts()

  return (
    <DataTable
      label="Drafts"
      columns={columns}
      rows={drafts.data}
      rowKey={(draft) => draft.id}
      isPending={drafts.isPending}
      isError={drafts.isError}
      isFetching={drafts.isFetching}
      error={drafts.error}
      onRetry={() => drafts.refetch()}
      empty={
        <EmptyState
          title="No drafts yet"
          description="Attach a client’s proposal and the AI drafts the contract from it, then you adjust it by chatting."
          action={<NewContractButton />}
        />
      }
    />
  )
}
