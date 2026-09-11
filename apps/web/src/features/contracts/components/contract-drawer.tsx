'use client'

import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import {
  BILLING_CYCLE_LABELS,
  CATALOG_UNIT_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TRANSITIONS,
  CONTRACT_TRANSITION_LABELS,
  formatCents,
  isEditable,
  lineTotalCents,
  type ContractDetail,
} from '../schema'
import { useContract, useSetContractStatus } from '../use-contracts'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

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

function ContractBody({
  contract,
  canManage,
  onEdit,
}: {
  contract: ContractDetail
  canManage: boolean
  onEdit: (contract: ContractDetail) => void
}) {
  const setStatus = useSetContractStatus()
  const editable = isEditable(contract.status)
  const next = CONTRACT_TRANSITIONS[contract.status]

  return (
    <Stack gap="lg">
      <Group gap="sm" wrap="wrap">
        <Badge color={CONTRACT_STATUS_COLORS[contract.status]} variant="light" size="lg">
          {CONTRACT_STATUS_LABELS[contract.status]}
        </Badge>
        <Text size="sm" c="dimmed">
          {contract.clientName} · {BILLING_CYCLE_LABELS[contract.billingCycle]}
        </Text>
      </Group>

      {canManage ? (
        <Group gap="xs" wrap="wrap">
          {editable ? (
            <Button
              variant="default"
              leftSection={<IconPencil size={16} aria-hidden />}
              onClick={() => onEdit(contract)}
            >
              Edit
            </Button>
          ) : null}

          {next.map((status) => (
            <Button
              key={status}
              variant={status === 'sent' || status === 'active' ? 'filled' : 'default'}
              color={status === 'cancelled' ? 'red' : undefined}
              loading={setStatus.isPending}
              onClick={() => setStatus.mutate({ contractId: contract.id, status })}
            >
              {CONTRACT_TRANSITION_LABELS[status]}
            </Button>
          ))}

          {next.length === 0 ? (
            // Terminal: say so rather than leaving a row of controls that would do nothing.
            <Text size="sm" c="dimmed">
              This contract is {CONTRACT_STATUS_LABELS[contract.status].toLowerCase()} and cannot
              change further.
            </Text>
          ) : null}
        </Group>
      ) : null}

      {!editable && canManage ? (
        <Text size="sm" c="dimmed">
          A contract the client has seen is not editable. Return it to draft to change what it says.
        </Text>
      ) : null}

      <Stack gap="xs">
        <Title order={3} size="h6">
          Services
        </Title>
        <Table withTableBorder withColumnBorders verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Service</Table.Th>
              <Table.Th scope="col" w={120}>
                Price
              </Table.Th>
              <Table.Th scope="col" w={80}>
                Qty
              </Table.Th>
              <Table.Th scope="col" w={120}>
                Total
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contract.lines.map((line) => (
              <Table.Tr key={line.id}>
                <Table.Th scope="row" fw={400}>
                  <Text size="sm">{line.name}</Text>
                </Table.Th>
                <Table.Td>
                  <Text size="sm">
                    {formatCents(line.unitPriceCents)}/{CATALOG_UNIT_LABELS[line.unit]}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{line.quantity}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {formatCents(lineTotalCents(line))}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" gap="sm">
          <Text size="sm" c="dimmed">
            Subtotal
          </Text>
          <Text fw={700} fz="lg">
            {formatCents(contract.subtotalCents)}
          </Text>
        </Group>
      </Stack>

      <Stack gap={4}>
        <Title order={3} size="h6">
          Dates
        </Title>
        <Text size="sm" c="dimmed">
          Starts {contract.startDate ? date.format(new Date(contract.startDate)) : 'not set'} · Ends{' '}
          {contract.endDate ? date.format(new Date(contract.endDate)) : 'open-ended'}
          {contract.signedAt ? ` · Agreed ${date.format(new Date(contract.signedAt))}` : ''}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={3} size="h6">
          Scope and terms
        </Title>
        {contract.terms ? (
          // Preserved as written: the composed terms carry their own line breaks.
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {contract.terms}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            No terms recorded on this contract.
          </Text>
        )}
      </Stack>
    </Stack>
  )
}
