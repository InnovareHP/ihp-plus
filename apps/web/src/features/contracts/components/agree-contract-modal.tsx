'use client'

import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { formatCents, type ContractDetail } from '../schema'

// Above the drawer this opens from, which shares Modal's default z-index of 200.
const ABOVE_DRAWER = 300

export interface AgreeContractModalProps {
  contract: Pick<ContractDetail, 'reference' | 'clientName' | 'billingCycle' | 'subtotalCents'>
  opened: boolean
  onClose: () => void
  onConfirm: () => void
}

// Agreeing sends the client a real invoice, which nothing in the portal can take back.
export function AgreeContractModal({
  contract,
  opened,
  onClose,
  onConfirm,
}: AgreeContractModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Agree ${contract.reference} and start billing?`}
      centered
      zIndex={ABOVE_DRAWER}
      closeButtonProps={{ 'aria-label': 'Close' }}
    >
      <Stack gap="md">
        <Text size="sm">
          {contract.billingCycle === 'project'
            ? `Stripe emails ${contract.clientName} an invoice for ${formatCents(contract.subtotalCents)} today.`
            : `Stripe invoices ${contract.clientName} every month, from the start date or from today if it has passed.`}
        </Text>
        <Text size="sm" c="dimmed">
          An invoice that has been sent cannot be recalled from the portal.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Keep as sent
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Agree and start billing
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
