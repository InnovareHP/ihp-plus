'use client'

import { Alert, Button, Skeleton, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { EmptyState } from '@/components/empty-state'
import {
  useAddClientToGroup,
  useClientGroups,
  useCreateClientGroup,
  useDeleteClientGroup,
  useRemoveClientFromGroup,
} from '../hooks/use-client-groups'
import { ClientGroupCard } from './client-group-card'
import { CreateGroupForm } from './create-group-form'
import { GroupAccessModal } from './group-access-modal'

export function ClientGroupsPanel() {
  const groups = useClientGroups()
  const create = useCreateClientGroup()
  const add = useAddClientToGroup()
  const remove = useRemoveClientFromGroup()
  const destroy = useDeleteClientGroup()
  const [sharingId, setSharingId] = useState<string | null>(null)

  const view = groups.data
  const sharing = view?.groups.find((group) => group.id === sharingId) ?? null
  const groupNameOf = (groupId: string) => view?.groups.find((group) => group.id === groupId)?.name

  return (
    <Stack gap="md" component="section" aria-labelledby="client-groups-heading">
      <Stack gap={4}>
        <Title order={2} id="client-groups-heading">
          Client groups
        </Title>
        <Text size="sm" c="dimmed" maw="70ch">
          When one owner runs several companies, put them in a group and share it once: their
          folders move under the group&apos;s, and one link opens all of them.
        </Text>
      </Stack>

      <CreateGroupForm
        onCreate={async (values) => {
          await create.mutateAsync({ ...values, tempId: crypto.randomUUID() })
        }}
      />

      {groups.isPending ? (
        <Stack gap="sm" aria-busy="true" aria-label="Loading client groups">
          <Skeleton height={180} radius="md" />
        </Stack>
      ) : groups.isError ? (
        <Alert role="alert" color="red" variant="light" title="Could not load client groups">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{groups.error.message}</Text>
            <Button size="compact-sm" variant="light" onClick={() => groups.refetch()}>
              Try again
            </Button>
          </Stack>
        </Alert>
      ) : view && view.groups.length > 0 ? (
        <Stack gap="md">
          {view.groups.map((group) => (
            <ClientGroupCard
              key={group.id}
              group={group}
              clients={view.clients}
              groupNameOf={groupNameOf}
              onAdd={async (clientId) => {
                await add.mutateAsync({ groupId: group.id, clientId })
              }}
              onRemove={(member) => remove.mutate({ groupId: group.id, clientId: member.id })}
              onShare={() => setSharingId(group.id)}
              onDelete={() => destroy.mutate({ id: group.id })}
            />
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="No client groups yet"
          description="Name one above to give an owner of several companies a single link to all of them."
        />
      )}

      <GroupAccessModal
        opened={sharing !== null}
        onClose={() => setSharingId(null)}
        group={sharing}
      />
    </Stack>
  )
}
