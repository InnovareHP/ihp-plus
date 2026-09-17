'use client'

import { Group, Skeleton, Stack, Text } from '@mantine/core'
import { useApprovers } from '../hooks/use-approvers'
import { AppointControl } from './appoint-control'
import { ApproverBadge } from './approver-badge'

export interface DepartmentApproversProps {
  teamId: string
  teamName: string
}

/** Who decides one department's requests, set where the department itself is managed. */
export function DepartmentApprovers({ teamId, teamName }: DepartmentApproversProps) {
  const approvers = useApprovers()

  if (approvers.isPending) return <Skeleton height={64} />

  if (approvers.isError) {
    return (
      <Text size="sm" c="red" role="alert">
        {approvers.error.message}
      </Text>
    )
  }

  // A department created after the list was read has no row yet, which means nobody appointed.
  const department = approvers.data.find((row) => row.teamId === teamId) ?? {
    teamId,
    teamName,
    approvers: [],
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Approvers
      </Text>
      <Text size="xs" c="dimmed">
        They decide requests raised in {teamName}. With nobody appointed, those requests go to
        admins only.
      </Text>

      {department.approvers.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nobody approves for {teamName} yet.
        </Text>
      ) : (
        <Group gap="xs" wrap="wrap">
          {department.approvers.map((approver) => (
            <ApproverBadge key={approver.userId} department={department} approver={approver} />
          ))}
        </Group>
      )}

      <AppointControl department={department} />
    </Stack>
  )
}
