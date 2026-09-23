'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Menu, Select, Stack, Text } from '@mantine/core'
import { Controller, useForm } from 'react-hook-form'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { offerUndo } from '@/lib/undo'
import { useRequireDocument, useUnrequireDocument } from '../hooks/use-checklist-setup'
import { documentIdSchema, type ChecklistSetup, type RequiredDocumentRow } from '../schema'

export interface RequiredReadingSetupProps {
  setup: ChecklistSetup
}

export function RequiredReadingSetup({ setup }: RequiredReadingSetupProps) {
  const require = useRequireDocument()
  const unrequire = useUnrequireDocument()
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ documentId: string }>({
    resolver: zodResolver(documentIdSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { documentId: '' },
  })

  function onSubmit(values: { documentId: string }) {
    // Optimistic: the row is on the list before the server answers, and rolls back if it refuses.
    require.mutate(values)
    reset({ documentId: '' })
  }

  function removeWithUndo(row: RequiredDocumentRow) {
    const previous = unrequire.apply({ documentId: row.documentId })
    offerUndo({
      message: `Took ${row.title} off the required reading`,
      undoLabel: 'Undo',
      onUndo: () => unrequire.restore(previous),
      onCommit: () => unrequire.commit.mutate({ documentId: row.documentId, previous }),
    })
  }

  const columns: DataTableColumn<RequiredDocumentRow>[] = [
    {
      key: 'title',
      header: 'Document',
      rowHeader: true,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.title}
        </Text>
      ),
    },
    {
      key: 'audience',
      header: 'Who reads it',
      render: (row) => <Text size="sm">{row.audience}</Text>,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      render: (row) => (
        <RowActionsMenu name={row.title}>
          <Menu.Item color="red" onClick={() => removeWithUndo(row)}>
            Remove from required reading
          </Menu.Item>
        </RowActionsMenu>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Group align="flex-end" gap="sm" wrap="wrap">
          <Controller
            control={control}
            name="documentId"
            render={({ field }) => (
              <Select
                label="Bluebook document"
                placeholder={
                  setup.availableDocuments.length === 0
                    ? 'Every document is already required'
                    : 'Choose a document'
                }
                data={setup.availableDocuments.map((document) => ({
                  value: document.id,
                  label: document.title,
                }))}
                searchable
                nothingFoundMessage="No document by that name"
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                error={errors.documentId ? 'Choose a document to require' : undefined}
                flex={1}
                miw={220}
              />
            )}
          />
          <Button type="submit">Require it</Button>
        </Group>
      </form>

      <DataTable
        label="Required reading"
        columns={columns}
        rows={setup.requiredDocuments}
        rowKey={(row) => row.documentId}
        isPending={false}
        minWidth={520}
        empty={
          <EmptyState
            title="No required reading yet"
            description="Pick the bluebook documents every new hire must read. Each one only reaches the departments its shelves cover."
          />
        }
      />
    </Stack>
  )
}
