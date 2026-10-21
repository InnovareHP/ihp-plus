'use client'

import { Modal } from '@mantine/core'
import { TimeSettingsForm } from './time-settings-form'

export interface TimeRulesModalProps {
  opened: boolean
  onClose: () => void
}

/**
 * The clock's rules belong with the clock, not in a personal settings page. The board opens this
 * from its toolbar, or from its "More" menu on a phone, and only for someone who may set them.
 */
export function TimeRulesModal({ opened, onClose }: TimeRulesModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Time tracking rules" centered size="lg">
      <TimeSettingsForm />
    </Modal>
  )
}
