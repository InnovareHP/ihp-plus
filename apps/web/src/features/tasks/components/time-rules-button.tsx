'use client'

import { Button, Modal } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useTimeSettings } from '../hooks/use-time'
import { TimeSettingsForm } from './time-settings-form'

/**
 * The clock's rules belong with the clock, not in a personal settings page. The button asks the
 * server who may set them, so a member never sees it.
 */
export function TimeRulesButton() {
  const settings = useTimeSettings()
  const [opened, modal] = useDisclosure(false)

  if (!settings.data?.canManage) return null

  return (
    <>
      <Button variant="default" onClick={modal.open}>
        Time rules
      </Button>
      <Modal opened={opened} onClose={modal.close} title="Time tracking rules" centered size="lg">
        <TimeSettingsForm />
      </Modal>
    </>
  )
}
