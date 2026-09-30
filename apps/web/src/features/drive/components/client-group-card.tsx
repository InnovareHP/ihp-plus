'use client'

import { Anchor, Button, Card, Divider, Group, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import type { ClientGroupRow, GroupableClient } from '../schema'
import { AddMemberForm } from './add-member-form'

export interface ClientGroupCardProps {
  group: ClientGroupRow
  clients: readonly GroupableClient[]
  groupNameOf: (groupId: string) => string | undefined
  onAdd: (clientId: string) => Promise<void>
  onRemove: (member: { id: string; name: string }) => void
  onShare: () => void
  onDelete: () => void
}

const people = new Intl.PluralRules('en-US')

export function ClientGroupCard({
  group,
  clients,
  groupNameOf,
  onAdd,
  onRemove,
  onShare,
  onDelete,
}: ClientGroupCardProps) {
  // Only the empty group can be deleted, and it takes its grants with it, so it asks once.
  const [confirming, setConfirming] = useState(false)
  const headingId = `group-${group.id}`
  const grants = `${group.activeGrants} ${people.select(group.activeGrants) === 'one' ? 'person' : 'people'}`

  return (
    <Card withBorder padding="lg" radius="md" component="section" aria-labelledby={headingId}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Title order={3} id={headingId}>
              {group.name}
            </Title>
            <Text size="sm" c="dimmed">
              {group.activeGrants === 0
                ? 'Not shared with anyone yet.'
                : `${grants} can open every company below with one link.`}
            </Text>
          </Stack>
          <Group gap="xs">
            {group.webUrl ? (
              <Anchor href={group.webUrl} target="_blank" rel="noreferrer" size="sm">
                Open in SharePoint
              </Anchor>
            ) : null}
            <Button variant="light" onClick={onShare}>
              Share folder
            </Button>
          </Group>
        </Group>

        {group.members.length === 0 ? (
          <Text size="sm">
            No companies yet. Add the ones this owner runs and their folders move in here.
          </Text>
        ) : (
          <Stack component="ul" gap={4} p={0} m={0} style={{ listStyle: 'none' }}>
            {group.members.map((member, index) => (
              <li key={member.id}>
                {index > 0 ? <Divider mb={4} /> : null}
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Text size="sm" truncate>
                    {member.name}
                  </Text>
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-sm"
                    aria-label={`Remove ${member.name} from ${group.name}`}
                    onClick={() => onRemove(member)}
                  >
                    Remove
                  </Button>
                </Group>
              </li>
            ))}
          </Stack>
        )}

        <AddMemberForm
          groupId={group.id}
          groupName={group.name}
          clients={clients}
          groupNameOf={groupNameOf}
          onAdd={onAdd}
        />

        {group.members.length === 0 ? (
          confirming ? (
            <Group gap="sm" wrap="wrap" role="group" aria-label={`Confirm deleting ${group.name}`}>
              <Text size="sm">
                {group.activeGrants > 0
                  ? `Delete ${group.name}? The ${grants} it is shared with lose the link.`
                  : `Delete ${group.name}?`}
              </Text>
              <Button color="red" size="compact-sm" onClick={onDelete}>
                Delete group
              </Button>
              <Button variant="default" size="compact-sm" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </Group>
          ) : (
            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="red"
                size="compact-sm"
                onClick={() => setConfirming(true)}
              >
                Delete group
              </Button>
            </Group>
          )
        ) : null}
      </Stack>
    </Card>
  )
}
