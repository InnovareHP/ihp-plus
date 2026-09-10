'use client'

import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { useMembers, useSetBanned, useSetOrganizationRole, useSetPortalRole } from '../use-members'
import { ORGANIZATION_ROLES, PORTAL_ROLE_LABELS, PORTAL_ROLES, type MemberRow } from '../schema'

const ORGANIZATION_OPTIONS = ORGANIZATION_ROLES.map((role) => ({ value: role, label: role }))
const PORTAL_OPTIONS = PORTAL_ROLES.map((role) => ({ value: role, label: PORTAL_ROLE_LABELS[role] }))

export function MembersTable() {
  const members = useMembers()
  const organizationRole = useSetOrganizationRole()
  const portalRole = useSetPortalRole()
  const banned = useSetBanned()

  if (members.isPending) return <MembersSkeleton />

  if (members.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load members">
          <Text size="sm">{members.error.message}</Text>
        </Alert>
        <Button onClick={() => members.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  if (members.data.length === 0) {
    return (
      <Text c="dimmed">
        Nobody has finished onboarding yet. The first person to complete it appears here.
      </Text>
    )
  }

  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Person</Table.Th>
            <Table.Th scope="col">Department</Table.Th>
            <Table.Th scope="col">Organization role</Table.Th>
            <Table.Th scope="col">Portal role</Table.Th>
            <Table.Th scope="col">Access</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {members.data.map((row) => (
            <Table.Tr key={row.memberId}>
              <Table.Th scope="row" fw={400}>
                <Stack gap={0}>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500}>
                      {row.name}
                    </Text>
                    {row.isSelf ? (
                      <Badge size="xs" variant="light">
                        You
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {row.email}
                  </Text>
                </Stack>
              </Table.Th>

              <Table.Td>
                <Text size="sm">{row.team ?? '—'}</Text>
              </Table.Td>

              <Table.Td>
                <Select
                  aria-label={`Organization role for ${row.name}`}
                  data={ORGANIZATION_OPTIONS}
                  value={row.organizationRole}
                  allowDeselect={false}
                  size="sm"
                  w={130}
                  onChange={(value) =>
                    value &&
                    organizationRole.mutate({
                      userId: row.userId,
                      memberId: row.memberId,
                      role: value as MemberRow['organizationRole'],
                    })
                  }
                />
              </Table.Td>

              <Table.Td>
                <Select
                  aria-label={`Portal role for ${row.name}`}
                  data={PORTAL_OPTIONS}
                  value={row.portalRole}
                  allowDeselect={false}
                  size="sm"
                  w={120}
                  onChange={(value) =>
                    value &&
                    portalRole.mutate({
                      userId: row.userId,
                      role: value as MemberRow['portalRole'],
                    })
                  }
                />
              </Table.Td>

              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <Badge color={row.banned ? 'red' : 'green'} variant="light">
                    {row.banned ? 'Suspended' : 'Active'}
                  </Badge>
                  {row.isSelf ? null : (
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      color={row.banned ? undefined : 'red'}
                      onClick={() => banned.mutate({ userId: row.userId, banned: !row.banned })}
                    >
                      {row.banned ? `Restore ${row.name}` : `Suspend ${row.name}`}
                    </Button>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

// Same row height and column count as the loaded table, so nothing shifts when data lands.
function MembersSkeleton() {
  return (
    <Stack gap="xs" aria-busy="true">
      <Skeleton height={38} />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={56} />
      ))}
    </Stack>
  )
}
