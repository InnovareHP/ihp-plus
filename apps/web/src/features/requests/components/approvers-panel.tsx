'use client'

import { Badge, Button, Group, Select, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/page-shell'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { approverQuerySchema, DEFAULT_APPROVER_QUERY } from '../schema'
// Organization membership is where the candidates come from; requests only appoints among them.
import { useAssignableUsers } from '@/features/organization/use-teams'
import type { DepartmentApproversRow } from '../schema'
import { useApprovers, useSetApprover } from '../use-approvers'

const parseApproverQuery = searchParamsParser(approverQuerySchema)

const APPROVER_FILTERS: readonly FilterControl[] = [
  {
    kind: 'toggle',
    key: 'unstaffedOnly',
    label: 'Only departments with no approver',
    help: 'Their requests reach admins and nobody else.',
  },
]

export function ApproversPanel() {
  const departments = useApprovers()
  const { query, setQuery, clearFilters } = useUrlQuery(parseApproverQuery, DEFAULT_APPROVER_QUERY)

  const term = query.search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      departments.data?.filter(
        (row) =>
          (row.teamName.toLowerCase().includes(term) ||
            row.approvers.some((approver) => approver.name.toLowerCase().includes(term))) &&
          (!query.unstaffedOnly || row.approvers.length === 0),
      ),
    [departments.data, term, query.unstaffedOnly],
  )
  const isFiltered = term.length > 0 || query.unstaffedOnly

  const columns: DataTableColumn<DepartmentApproversRow>[] = [
    {
      key: 'department',
      header: 'Department',
      rowHeader: true,
      width: 220,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.teamName}
        </Text>
      ),
    },
    {
      key: 'approvers',
      header: 'Approvers',
      render: (row) =>
        row.approvers.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nobody yet — its requests reach admins only.
          </Text>
        ) : (
          <Group gap="xs" wrap="wrap">
            {row.approvers.map((approver) => (
              <ApproverBadge key={approver.userId} department={row} approver={approver} />
            ))}
          </Group>
        ),
    },
    {
      key: 'add',
      header: 'Appoint',
      width: 340,
      render: (row) => <AppointControl department={row} />,
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="departments"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={APPROVER_FILTERS}
      />

      <DataTable
        label="Department approvers"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.teamId}
        isPending={departments.isPending}
        isError={departments.isError}
        isFetching={departments.isFetching}
        error={departments.error}
        onRetry={() => departments.refetch()}
        minWidth={880}
        isFiltered={isFiltered}
        noResults={
          <EmptyState
            title="No departments match those filters"
            description="Clear them to see every department."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
        empty={
          <EmptyState
            title="No departments yet"
            description="Create a department first, then appoint who decides its requests."
          />
        }
      />
    </Stack>
  )
}

function ApproverBadge({
  department,
  approver,
}: {
  department: DepartmentApproversRow
  approver: DepartmentApproversRow['approvers'][number]
}) {
  const setApprover = useSetApprover()

  return (
    <Badge
      variant="light"
      size="lg"
      rightSection={
        <Button
          variant="transparent"
          size="compact-xs"
          color="red"
          px={0}
          aria-label={`Remove ${approver.name} as an approver for ${department.teamName}`}
          onClick={() =>
            setApprover.mutate({
              teamId: department.teamId,
              userId: approver.userId,
              approver: false,
              name: approver.name,
              email: approver.email,
            })
          }
        >
          Remove
        </Button>
      }
    >
      {approver.name}
    </Badge>
  )
}

function AppointControl({ department }: { department: DepartmentApproversRow }) {
  const people = useAssignableUsers()
  const setApprover = useSetApprover()
  // Which name is showing in this row's picker before it is appointed: local, ephemeral UI.
  const [picked, setPicked] = useState<string | null>(null)

  const appointed = new Set(department.approvers.map((approver) => approver.userId))
  const candidates = (people.data ?? []).filter((person) => !appointed.has(person.userId))
  const chosen = candidates.find((person) => person.userId === picked)

  return (
    <Group align="flex-end" gap="xs" wrap="nowrap">
      <Select
        aria-label={`Add an approver for ${department.teamName}`}
        placeholder={people.isPending ? 'Loading…' : 'Search people'}
        searchable
        size="sm"
        nothingFoundMessage="Nobody left to appoint"
        disabled={people.isPending}
        value={picked}
        onChange={setPicked}
        data={candidates.map((person) => ({
          value: person.userId,
          label: person.teamName ? `${person.name} · ${person.teamName}` : person.name,
        }))}
        w={220}
      />
      <Button
        size="sm"
        disabled={!chosen}
        onClick={() => {
          if (!chosen) return
          setApprover.mutate({
            teamId: department.teamId,
            userId: chosen.userId,
            approver: true,
            name: chosen.name,
            email: chosen.email,
          })
          setPicked(null)
        }}
      >
        Appoint
      </Button>
    </Group>
  )
}
