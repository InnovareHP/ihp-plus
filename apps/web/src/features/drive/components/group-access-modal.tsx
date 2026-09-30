'use client'

import { Divider, Modal, Stack, Text } from '@mantine/core'
import {
  useGroupAccess,
  useRevokeGroupAccess,
  useShareGroupFolder,
} from '../hooks/use-group-access'
import type { ClientAccessRow, ClientGroupRow } from '../schema'
import { ClientAccessList } from './client-access-list'
import { ShareFolderForm } from './share-folder-form'

export interface GroupAccessModalProps {
  opened: boolean
  onClose: () => void
  group: ClientGroupRow | null
}

const list = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' })

export function GroupAccessModal({ opened, onClose, group }: GroupAccessModalProps) {
  const groupId = group?.id ?? ''
  const access = useGroupAccess(groupId, opened && groupId !== '')
  const share = useShareGroupFolder(groupId)
  const revoke = useRevokeGroupAccess(groupId)

  const name = group?.name ?? 'this group'
  const members = group?.members.map((member) => member.name) ?? []

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Folder access for ${name}`}
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': 'Close folder access' }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {members.length > 0
            ? `One link opens ${list.format(members)}, and any company added to ${name} later.`
            : `Add companies to ${name} and one link opens all of them.`}
        </Text>

        <ShareFolderForm
          clientName={name}
          onShare={async (values) => {
            await share.mutateAsync(values)
          }}
        />

        <Divider label="Who can open it" labelPosition="left" />

        <ClientAccessList
          rows={access.data ?? []}
          isPending={access.isPending}
          isRevoking={revoke.isPending}
          error={access.error}
          onRetry={() => access.refetch()}
          onRevoke={(row: ClientAccessRow) => revoke.mutate({ id: row.id, email: row.email })}
        />
      </Stack>
    </Modal>
  )
}
