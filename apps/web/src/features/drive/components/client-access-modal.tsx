'use client'

import { Divider, Modal, Stack, Text } from '@mantine/core'
import {
  useClientAccess,
  useRevokeClientAccess,
  useShareClientFolder,
} from '../hooks/use-client-access'
import type { ClientAccessRow } from '../schema'
import { ClientAccessList } from './client-access-list'
import { ShareFolderForm } from './share-folder-form'

export interface ClientAccessModalProps {
  opened: boolean
  onClose: () => void
  client: { id: string; name: string } | null
}

export function ClientAccessModal({ opened, onClose, client }: ClientAccessModalProps) {
  const clientId = client?.id ?? ''
  const access = useClientAccess(clientId, opened && clientId !== '')
  const share = useShareClientFolder(clientId)
  const revoke = useRevokeClientAccess(clientId)

  const title = `Folder access for ${client?.name ?? 'this client'}`

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="lg"
      closeButtonProps={{ 'aria-label': 'Close folder access' }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Anything your team files under <strong>Clients/{client?.name}/Shared</strong> appears in
          this folder. The people below open it in SharePoint with their own sign-in.
        </Text>

        <ShareFolderForm
          clientName={client?.name ?? 'this client'}
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
