'use client'

import { Badge, Button, CloseButton, Group, Select, Skeleton, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import {
  useAddDepartmentLead,
  useDepartmentLeads,
  useRemoveDepartmentLead,
} from '@/features/teams/use-department-leads'

export interface DepartmentLeadsProps {
  teamId: string
  teamName: string
  /** Read-only for everyone else: who leads a department is ordinary company information. */
  canEdit: boolean
}

/**
 * Who leads one department, edited where the department itself is. It used to live in a modal
 * off the handbook, which is one of the things a lead does rather than what a lead is.
 */
export function DepartmentLeads({ teamId, teamName, canEdit }: DepartmentLeadsProps) {
  const leads = useDepartmentLeads()
  const addLead = useAddDepartmentLead()
  const removeLead = useRemoveDepartmentLead()
  // Which name is showing in the picker before it is appointed: local, ephemeral UI.
  const [picked, setPicked] = useState<string | null>(null)

  if (leads.isPending) return <Skeleton height={64} />

  if (leads.isError) {
    return (
      <Text size="sm" c="red" role="alert">
        {leads.error.message}
      </Text>
    )
  }

  const view = leads.data
  const appointed = view.leads.filter((lead) => lead.teamId === teamId)
  const appointedIds = new Set(appointed.map((lead) => lead.userId))
  const candidates = view.members.filter((member) => !appointedIds.has(member.id))
  const chosen = candidates.find((member) => member.id === picked)

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Leads
      </Text>

      {appointed.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nobody leads {teamName} yet.
        </Text>
      ) : (
        <Group gap="xs" wrap="wrap">
          {appointed.map((lead) => {
            const name = view.members.find((member) => member.id === lead.userId)?.name ?? 'Unknown'
            return (
              <Badge
                key={lead.userId}
                variant="light"
                size="lg"
                rightSection={
                  canEdit ? (
                    <CloseButton
                      size="xs"
                      variant="transparent"
                      aria-label={`Remove ${name} as a lead of ${teamName}`}
                      onClick={() => removeLead.mutate({ teamId, userId: lead.userId })}
                    />
                  ) : undefined
                }
              >
                {name}
              </Badge>
            )
          })}
        </Group>
      )}

      {canEdit ? (
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <Select
            aria-label={`Add a lead for ${teamName}`}
            placeholder="Search people"
            searchable
            size="sm"
            nothingFoundMessage="Nobody left to appoint"
            value={picked}
            onChange={setPicked}
            data={candidates.map((member) => ({ value: member.id, label: member.name }))}
            style={{ flex: 1 }}
          />
          <Button
            size="sm"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              addLead.mutate({ teamId, userId: chosen.id })
              setPicked(null)
            }}
          >
            Add lead
          </Button>
        </Group>
      ) : null}
    </Stack>
  )
}
