'use client'

import { ActionIcon, Badge, Button, Group, Menu, Modal, Stack, Text } from '@mantine/core'
import { IconDotsVertical, IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { LinkButton } from '@/components/link-button'
import { EmptyState } from '@/components/empty-state'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import {
  evaluationFormRoute,
  NEW_EVALUATION_FORM_ROUTE,
  NEW_REQUEST_FORM_ROUTE,
  requestFormRoute,
} from '@/lib/routes'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
// Departments are organization data; the requests feature is a consumer of them.
import { useTeams } from '@/features/organization/hooks/use-teams'
import {
  DEFAULT_FORM_QUERY,
  FORM_STATUS_LABELS,
  FORM_STATUS_OPTIONS,
  formQuerySchema,
  type FormKind,
  type FormRow,
} from '../schema'
import { useDeleteForm, useForms, useSetFormStatus } from '../hooks/use-forms'

const updated = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

const parseFormQuery = searchParamsParser(formQuerySchema, ['teamIds'])

const STATUS_COLORS: Record<FormRow['status'], string> = {
  draft: 'gray',
  published: 'green',
  archived: 'yellow',
}

const departmentsColumn: DataTableColumn<FormRow> = {
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
}

export interface FormsTableProps {
  /** Which catalogue to list: the request forms or the evaluation forms. */
  kind?: FormKind
}

// One table for both kinds: an evaluation form has no department, so that column and filter
// are the only difference.
export function FormsTable({ kind = 'request' }: FormsTableProps) {
  const isEvaluation = kind === 'evaluation'
  const newFormRoute = isEvaluation ? NEW_EVALUATION_FORM_ROUTE : NEW_REQUEST_FORM_ROUTE
  const editRoute = isEvaluation ? evaluationFormRoute : requestFormRoute
  const forms = useForms(kind)
  const teams = useTeams()
  const setStatus = useSetFormStatus(kind)
  const deleteForm = useDeleteForm(kind)
  const [deleting, setDeleting] = useState<FormRow | null>(null)
  const { query, setQuery, clearFilters } = useUrlQuery(parseFormQuery, DEFAULT_FORM_QUERY)

  const filters: readonly FilterControl[] = isEvaluation
    ? [{ kind: 'select', key: 'status', label: 'Status', options: FORM_STATUS_OPTIONS }]
    : [
        { kind: 'select', key: 'status', label: 'Status', options: FORM_STATUS_OPTIONS },
        {
          kind: 'multi',
          key: 'teamIds',
          label: 'Offered to',
          options: (teams.data ?? []).map((team) => ({ value: team.id, label: team.name })),
        },
        {
          kind: 'toggle',
          key: 'unplacedOnly',
          label: 'Only forms with no department',
          help: 'A published form offered to nobody reaches nobody.',
        },
      ]

  const term = query.search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      forms.data?.filter(
        (form) =>
          (form.name.toLowerCase().includes(term) ||
            form.description.toLowerCase().includes(term)) &&
          (!query.status || form.status === query.status) &&
          (query.teamIds.length === 0 ||
            form.teams.some((team) => query.teamIds.includes(team.id))) &&
          (!query.unplacedOnly || form.teams.length === 0),
      ),
    [forms.data, term, query.status, query.teamIds, query.unplacedOnly],
  )
  const isFiltered =
    term.length > 0 || Boolean(query.status) || query.teamIds.length > 0 || query.unplacedOnly

  const columns: DataTableColumn<FormRow>[] = [
    {
      key: 'name',
      header: 'Form',
      rowHeader: true,
      render: (form) => (
        <Stack gap={0}>
          <Link href={editRoute(form.id)}>{form.name}</Link>
          <Text size="xs" c="dimmed">
            {form.fields.length} {form.fields.length === 1 ? 'question' : 'questions'} · updated{' '}
            {updated.format(new Date(form.updatedAt))}
          </Text>
        </Stack>
      ),
    },
    ...(isEvaluation ? [] : [departmentsColumn]),
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
      key: 'submissions',
      header: isEvaluation ? 'Evaluations' : 'Requests',
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
            <Menu.Item component={Link} href={editRoute(form.id)}>
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
      <TableToolbar
        label="forms"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
        action={
          <LinkButton href={newFormRoute} leftSection={<IconPlus size={16} aria-hidden />}>
            New form
          </LinkButton>
        }
      />

      <DataTable
        label={isEvaluation ? 'Evaluation forms' : 'Request forms'}
        columns={columns}
        rows={rows}
        rowKey={(form) => form.id}
        isPending={forms.isPending}
        isError={forms.isError}
        isFetching={forms.isFetching}
        error={forms.error}
        onRetry={() => forms.refetch()}
        minWidth={880}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="No forms match those filters"
            description="Clear them to see every form this organization has."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title={isEvaluation ? 'No evaluation forms yet' : 'No request forms yet'}
            description={
              isEvaluation
                ? 'Build the first one and you can assign it to a supervisor.'
                : 'Build the first one and pick which departments it is offered to.'
            }
            action={<LinkButton href={newFormRoute}>New form</LinkButton>}
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
            Deleting {deleting?.name} cannot be undone. A form that has already been filled in can
            only be archived, which keeps those answers readable.
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
