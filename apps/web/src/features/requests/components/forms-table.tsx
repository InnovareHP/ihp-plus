'use client'

import { ActionIcon, Badge, Button, Group, Menu, Modal, Stack, Text } from '@mantine/core'
import { IconDotsVertical, IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { LinkButton } from '@/components/link-button'
import { EmptyState } from '@/components/page-shell'
import { NEW_REQUEST_FORM_ROUTE, requestFormRoute } from '@/lib/routes'
import { FORM_STATUS_LABELS, type FormRow } from '../schema'
import { useDeleteForm, useForms, useSetFormStatus } from '../use-forms'

const updated = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

const STATUS_COLORS: Record<FormRow['status'], string> = {
  draft: 'gray',
  published: 'green',
  archived: 'yellow',
}

export function FormsTable() {
  const forms = useForms()
  const setStatus = useSetFormStatus()
  const deleteForm = useDeleteForm()
  const [deleting, setDeleting] = useState<FormRow | null>(null)

  const columns: DataTableColumn<FormRow>[] = [
    {
      key: 'name',
      header: 'Form',
      rowHeader: true,
      render: (form) => (
        <Stack gap={0}>
          <Link href={requestFormRoute(form.id)}>{form.name}</Link>
          <Text size="xs" c="dimmed">
            {form.fields.length} {form.fields.length === 1 ? 'question' : 'questions'} · updated{' '}
            {updated.format(new Date(form.updatedAt))}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'departments',
      header: 'Departments',
      render: (form) =>
        form.teams.length === 0 ? (
          <Text size="sm" c="dimmed">
            None yet
          </Text>
        ) : (
          <Group gap={4} wrap="wrap">
            {form.teams.map((team) => (
              <Badge key={team.id} variant="light" size="sm">
                {team.name}
              </Badge>
            ))}
          </Group>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (form) => (
        <Badge color={STATUS_COLORS[form.status]} variant="light">
          {FORM_STATUS_LABELS[form.status]}
        </Badge>
      ),
    },
    {
      key: 'requests',
      header: 'Requests',
      width: 110,
      render: (form) => <Text size="sm">{form.submissionCount}</Text>,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 80,
      align: 'right',
      render: (form) => (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${form.name}`}>
              <IconDotsVertical size={16} aria-hidden />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item component={Link} href={requestFormRoute(form.id)}>
              Edit
            </Menu.Item>
            {form.status === 'published' ? (
              <Menu.Item onClick={() => setStatus.mutate({ formId: form.id, status: 'archived' })}>
                Archive
              </Menu.Item>
            ) : (
              <Menu.Item onClick={() => setStatus.mutate({ formId: form.id, status: 'published' })}>
                Publish
              </Menu.Item>
            )}
            {form.status !== 'draft' ? (
              <Menu.Item onClick={() => setStatus.mutate({ formId: form.id, status: 'draft' })}>
                Move to draft
              </Menu.Item>
            ) : null}
            <Menu.Item color="red" onClick={() => setDeleting(form)}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <LinkButton href={NEW_REQUEST_FORM_ROUTE} leftSection={<IconPlus size={16} aria-hidden />}>
          New form
        </LinkButton>
      </Group>

      <DataTable
        label="Request forms"
        columns={columns}
        rows={forms.data}
        rowKey={(form) => form.id}
        isPending={forms.isPending}
        isError={forms.isError}
        isFetching={forms.isFetching}
        error={forms.error}
        onRetry={() => forms.refetch()}
        minWidth={880}
        empty={
          <EmptyState
            title="No request forms yet"
            description="Build the first one and pick which departments it is offered to."
            action={<LinkButton href={NEW_REQUEST_FORM_ROUTE}>New form</LinkButton>}
          />
        }
      />

      <Modal
        opened={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        centered
        title={`Delete ${deleting?.name ?? 'form'}?`}
      >
        <Stack gap="md">
          <Text size="sm">
            Deleting {deleting?.name} cannot be undone. A form that already has requests against it
            can only be archived, which keeps those requests readable.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button
              color="red"
              loading={deleteForm.isPending}
              onClick={() => {
                if (!deleting) return
                deleteForm.mutate({ formId: deleting.id })
                setDeleting(null)
              }}
            >
              Delete form
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
