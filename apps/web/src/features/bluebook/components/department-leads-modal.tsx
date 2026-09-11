'use client'

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useAddDepartmentLead, useDepartmentLeads, useRemoveDepartmentLead } from '../use-bluebook'

export interface DepartmentLeadsModalProps {
  opened: boolean
  onClose: () => void
  /** Read-only for everyone else: who leads a department is ordinary company information. */
  canEdit: boolean
}

export function DepartmentLeadsModal({ opened, onClose, canEdit }: DepartmentLeadsModalProps) {
  const leads = useDepartmentLeads()
  const addLead = useAddDepartmentLead()
  const removeLead = useRemoveDepartmentLead()
  const [teamId, setTeamId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const data = leads.data
  const nameOf = (id: string) => data?.members.find((member) => member.id === id)?.name ?? id

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Department leads"
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': 'Close department leads' }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          A lead files documents on their own department&apos;s shelf and on the all-departments
          one. Admins can file anywhere.
        </Text>

        {leads.isPending ? <Text size="sm">Loading departments…</Text> : null}
        {leads.isError ? (
          <Text size="sm" role="alert" c="red">
            {leads.error.message}
          </Text>
        ) : null}

        {data ? (
          <ScrollArea.Autosize mah={320}>
            <Stack gap="sm">
              {data.teams.map((team) => {
                const forTeam = data.leads.filter((lead) => lead.teamId === team.id)

                return (
                  <Group key={team.id} justify="space-between" wrap="nowrap" align="flex-start">
                    <Text size="sm" fw={500} w={180}>
                      {team.name}
                    </Text>
                    <Group gap="xs" justify="flex-end" style={{ flex: 1 }}>
                      {forTeam.length === 0 ? (
                        <Text size="sm" c="dimmed">
                          No lead yet
                        </Text>
                      ) : (
                        forTeam.map((lead) => (
                          <Badge
                            key={lead.userId}
                            variant="light"
                            size="lg"
                            rightSection={
                              canEdit ? (
                                <ActionIcon
                                  size="xs"
                                  variant="transparent"
                                  color="gray"
                                  aria-label={`Remove ${nameOf(lead.userId)} as lead of ${team.name}`}
                                  onClick={() =>
                                    removeLead.mutate({ teamId: team.id, userId: lead.userId })
                                  }
                                >
                                  <IconX size={12} aria-hidden />
                                </ActionIcon>
                              ) : undefined
                            }
                          >
                            {nameOf(lead.userId)}
                          </Badge>
                        ))
                      )}
                    </Group>
                  </Group>
                )
              })}
            </Stack>
          </ScrollArea.Autosize>
        ) : null}

        {canEdit && data ? (
          <Group align="flex-end" gap="sm" wrap="wrap">
            <Select
              label="Department"
              data={data.teams.map((team) => ({ value: team.id, label: team.name }))}
              value={teamId}
              onChange={setTeamId}
              searchable
              w={{ base: '100%', sm: 200 }}
            />
            <Select
              label="Person"
              data={data.members.map((member) => ({ value: member.id, label: member.name }))}
              value={userId}
              onChange={setUserId}
              searchable
              nothingFoundMessage="No match"
              w={{ base: '100%', sm: 220 }}
            />
            <Button
              loading={addLead.isPending}
              disabled={!teamId || !userId}
              onClick={() => {
                if (!teamId || !userId) return
                addLead.mutate({ teamId, userId }, { onSuccess: () => setUserId(null) })
              }}
            >
              Add lead
            </Button>
          </Group>
        ) : null}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
