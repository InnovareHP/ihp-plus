'use client'

import { Alert, Button, Drawer, Skeleton, Stack, Text } from '@mantine/core'
import type { ContractDetail } from '../schema'
import { useContract } from '../use-contracts'
import { ContractBody } from './contract-body'
export interface ContractDrawerProps {
  contractId: string | null
  onClose: () => void
  canManage: boolean
  /** The edit form is a sibling of this drawer, not a child: nesting two overlays leaves
      which one paints on top to mount order, since both default to the same z-index. */
  onEdit: (contract: ContractDetail) => void
}

export function ContractDrawer({ contractId, onClose, canManage, onEdit }: ContractDrawerProps) {
  const contract = useContract(contractId ?? '')

  return (
    <Drawer
      opened={contractId !== null}
      onClose={onClose}
      position="right"
      size="xl"
      title={contract.data ? `${contract.data.reference} · ${contract.data.title}` : 'Contract'}
    >
      {contract.isPending ? (
        <Stack gap="md" aria-busy="true">
          <Skeleton height={80} />
          <Skeleton height={160} />
          <Skeleton height={200} />
        </Stack>
      ) : contract.isError ? (
        <Stack gap="md">
          <Alert role="alert" color="red" variant="light" title="Could not load this contract">
            <Text size="sm">{contract.error.message}</Text>
          </Alert>
          <Button onClick={() => contract.refetch()} w="fit-content">
            Try again
          </Button>
        </Stack>
      ) : (
        <ContractBody contract={contract.data} canManage={canManage} onEdit={onEdit} />
      )}
    </Drawer>
  )
}
