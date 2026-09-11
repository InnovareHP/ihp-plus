'use client'

import { Button, Group, Select } from '@mantine/core'
import { useState } from 'react'
// Organization membership is where the candidates come from; requests only appoints among them.
import { useAssignableUsers } from '@/features/organization/hooks/use-teams'
import { useSetApprover } from '../hooks/use-approvers'
import type { DepartmentApproversRow } from '../schema'

export function AppointControl({ department }: { department: DepartmentApproversRow }) {
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
