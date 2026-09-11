'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Badge, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { FormError } from '@/components/form-error'
import { EmptyState, PageSection } from '@/components/page-shell'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { announceSuccess } from '@/lib/announce'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import {
  DEFAULT_INVITATION_QUERY,
  INVITABLE_ROLES,
  invitationQuerySchema,
  inviteMemberSchema,
  type InvitationRow,
  type InviteMemberValues,
} from '../schema'
import {
  useCancelInvitation,
  useInvitations,
  useInviteMember,
  useResendInvitation,
} from '../use-invitations'
import { useTeams } from '../use-teams'

const ROLE_OPTIONS = INVITABLE_ROLES.map((role) => ({
  value: role,
  label: role === 'admin' ? 'Admin' : 'Member',
}))

const expires = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const parseInvitationQuery = searchParamsParser(invitationQuerySchema)

const INVITATION_FILTERS: readonly FilterControl[] = [
  {
    kind: 'select',
    key: 'role',
    label: 'Organization role',
    options: [
      { value: 'admin', label: 'Admin' },
      { value: 'member', label: 'Member' },
    ],
  },
  {
    kind: 'toggle',
    key: 'expiredOnly',
    label: 'Only expired invitations',
    help: 'The ones that lapsed before anyone accepted them.',
  },
]

export function InvitationsPanel({ invitedBy }: { invitedBy: string }) {
  return (
    <>
      <InviteForm invitedBy={invitedBy} />
      <PageSection
        title="Pending invitations"
        description="Invitations stay here until they are accepted, cancelled, or they expire."
      >
        <InvitationsTable />
      </PageSection>
    </>
  )
}

function InviteForm({ invitedBy }: { invitedBy: string }) {
  const teams = useTeams()
  const invite = useInviteMember()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '', role: 'member', teamId: '' },
  })

  async function onSubmit(values: InviteMemberValues) {
    const teamName = teams.data?.find((team) => team.id === values.teamId)?.name ?? 'their team'

    try {
      await invite.mutateAsync({ ...values, teamName, invitedBy })
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Could not invite.' })
      return
    }

    reset({ email: '', role: values.role, teamId: values.teamId })
    announceSuccess(`Invitation sent to ${values.email}.`)
  }

  return (
    <PageSection
      title="Invite someone"
      description="They get a link to join this organization in the department you pick."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <FormError message={errors.root?.message} title="Could not send the invitation" />

          <TextInput
            {...register('email')}
            label="Work email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@innovarehp.com"
            required
            aria-required="true"
            error={errors.email?.message}
          />

          <Group grow align="flex-start">
            <Controller
              control={control}
              name="teamId"
              render={({ field }) => (
                <Select
                  label="Department"
                  // Both fields in the row need a description, or their inputs misalign.
                  description="They can be moved later."
                  placeholder={teams.isPending ? 'Loading…' : 'Pick a department'}
                  searchable
                  required
                  aria-required="true"
                  disabled={teams.isPending}
                  data={(teams.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? '')}
                  onBlur={field.onBlur}
                  error={errors.teamId?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select
                  label="Organization role"
                  description="Admins can manage members and departments."
                  data={ROLE_OPTIONS}
                  allowDeselect={false}
                  value={field.value}
                  onChange={(value) => value && field.onChange(value)}
                  onBlur={field.onBlur}
                  error={errors.role?.message}
                />
              )}
            />
          </Group>

          <Group>
            <Button
              type="submit"
              loading={isSubmitting}
              leftSection={<IconSend size={16} aria-hidden />}
            >
              {isSubmitting ? 'Sending…' : 'Send invite'}
            </Button>
          </Group>
        </Stack>
      </form>
    </PageSection>
  )
}

function InvitationsTable() {
  const invitations = useInvitations()
  const cancel = useCancelInvitation()
  const resend = useResendInvitation()
  const { query, setQuery, clearFilters } = useUrlQuery(
    parseInvitationQuery,
    DEFAULT_INVITATION_QUERY,
  )

  const term = query.search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      invitations.data?.filter(
        (row) =>
          (row.email.toLowerCase().includes(term) ||
            (row.teamName ?? '').toLowerCase().includes(term)) &&
          (!query.role || row.role === query.role) &&
          (!query.expiredOnly || row.expired),
      ),
    [invitations.data, term, query.role, query.expiredOnly],
  )
  const isFiltered = term.length > 0 || Boolean(query.role) || query.expiredOnly

  const columns: DataTableColumn<InvitationRow>[] = [
    {
      key: 'email',
      header: 'Invited',
      rowHeader: true,
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.email}
          </Text>
          <Text size="xs" c="dimmed">
            by {row.invitedBy}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'team',
      header: 'Department',
      render: (row) => <Text size="sm">{row.teamName ?? '—'}</Text>,
    },
    {
      key: 'role',
      header: 'Role',
      width: 120,
      render: (row) => (
        <Badge variant="light" tt="capitalize">
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      width: 200,
      render: (row) => (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" c={row.expired ? 'red' : 'dimmed'}>
            {expires.format(new Date(row.expiresAt))}
          </Text>
          {row.expired ? (
            <Badge color="red" variant="light" size="sm">
              Expired
            </Badge>
          ) : null}
        </Group>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 190,
      align: 'right',
      render: (row) => (
        <Group gap="xs" justify="flex-end" wrap="nowrap">
          <Button
            variant="subtle"
            size="compact-sm"
            aria-label={`Resend the invitation to ${row.email}`}
            loading={resend.isPending && resend.variables?.invitationId === row.id}
            onClick={() => resend.mutate({ invitationId: row.id, email: row.email })}
          >
            Resend
          </Button>
          <Button
            variant="subtle"
            color="red"
            size="compact-sm"
            aria-label={`Cancel the invitation to ${row.email}`}
            onClick={() => cancel.mutate({ invitationId: row.id })}
          >
            Cancel
          </Button>
        </Group>
      ),
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="invitations"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={INVITATION_FILTERS}
      />

      <DataTable
        label="Pending invitations"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isPending={invitations.isPending}
        isError={invitations.isError}
        isFetching={invitations.isFetching}
        error={invitations.error}
        onRetry={() => invitations.refetch()}
        minWidth={760}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="No invitations match those filters"
            description="Clear them to see everyone still waiting to accept."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="No invitations waiting"
            description="Invite a colleague above and their invitation appears here until they accept it."
          />
        }
      />
    </Stack>
  )
}
