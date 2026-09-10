'use client'

import { Alert, Badge, Button, Card, Group, Select, Skeleton, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { EmptyState } from '@/components/page-shell'
// Organization membership is where the candidates come from; requests only appoints among them.
import { useAssignableUsers } from '@/features/organization/use-teams'
import type { DepartmentApproversRow } from '../schema'
import { useApprovers, useSetApprover } from '../use-approvers'

export function ApproversPanel() {
  const departments = useApprovers()

  if (departments.isPending) {
    return (
      <Stack gap="md" aria-busy="true">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={128} radius="md" />
        ))}
      </Stack>
    )
  }

  if (departments.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load the approvers">
          <Text size="sm">{departments.error.message}</Text>
        </Alert>
        <Button onClick={() => departments.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  if (departments.data.length === 0) {
    return (
      <EmptyState
        title="No departments yet"
        description="Create a department first, then appoint who decides its requests."
      />
    )
  }

  return (
    <Stack gap="md">
      {departments.data.map((department) => (
        <DepartmentCard key={department.teamId} department={department} />
      ))}
    </Stack>
  )
}

function DepartmentCard({ department }: { department: DepartmentApproversRow }) {
  const people = useAssignableUsers()
  const setApprover = useSetApprover()
  const [picked, setPicked] = useState<string | null>(null)

  const appointed = new Set(department.approvers.map((approver) => approver.userId))
  const candidates = (people.data ?? []).filter((person) => !appointed.has(person.userId))
  const chosen = candidates.find((person) => person.userId === picked)

  return (
    <Card padding="lg" component="section">
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={600}>{department.teamName}</Text>
          <Text size="sm" c="dimmed">
            {department.approvers.length === 0
              ? 'Nobody decides this department yet, so its requests only reach admins.'
              : `${department.approvers.length} ${department.approvers.length === 1 ? 'approver' : 'approvers'} decide its requests.`}
          </Text>
        </Stack>

        {department.approvers.length > 0 ? (
          <Group gap="xs" wrap="wrap">
            {department.approvers.map((approver) => (
              <Badge
                key={approver.userId}
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
            ))}
          </Group>
        ) : null}

        <Group align="flex-end" gap="sm" wrap="wrap">
          <Select
            label={`Add an approver for ${department.teamName}`}
            placeholder={people.isPending ? 'Loading…' : 'Search people'}
            searchable
            nothingFoundMessage="Nobody left to appoint"
            disabled={people.isPending}
            value={picked}
            onChange={setPicked}
            data={candidates.map((person) => ({
              value: person.userId,
              label: person.teamName ? `${person.name} · ${person.teamName}` : person.name,
            }))}
            w={{ base: '100%', sm: 320 }}
          />
          <Button
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
      </Stack>
    </Card>
  )
}
