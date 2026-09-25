'use client'

import { Alert, Button, Modal, Skeleton, Stack } from '@mantine/core'
import { useBulletinSettings, useSaveBulletinSettings } from '../hooks/use-bulletin-settings'
import { CelebrationSettingsForm } from './celebration-settings-form'

export interface CelebrationSettingsModalProps {
  opened: boolean
  onClose: () => void
}

export function CelebrationSettingsModal({ opened, onClose }: CelebrationSettingsModalProps) {
  const settings = useBulletinSettings(opened)
  const save = useSaveBulletinSettings()

  return (
    <Modal opened={opened} onClose={onClose} title="Automatic posts" centered>
      {settings.isPending ? (
        <Stack gap="md" aria-busy="true" aria-label="Loading automatic posts">
          <Skeleton height={20} />
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </Stack>
      ) : settings.isError ? (
        <Alert color="red" variant="light" title="Could not load these settings" role="alert">
          <Button variant="default" mt="sm" onClick={() => void settings.refetch()}>
            Try again
          </Button>
        </Alert>
      ) : (
        <CelebrationSettingsForm
          settings={settings.data}
          onCancel={onClose}
          onSave={async (values) => {
            await save.mutateAsync(values)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}
