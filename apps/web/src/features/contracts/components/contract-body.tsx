'use client'

import { Badge, Button, Group, Stack, Table, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPencil, IconReceipt } from '@tabler/icons-react'
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
  type ContractStatus,
} from '../schema'
import { useSetContractStatus } from '../use-contracts'
import { AgreeContractModal } from './agree-contract-modal'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export function ContractBody({
  contract,
  canManage,
  billingEnabled,
  onEdit,
}: {
  contract: ContractDetail
  canManage: boolean
  /** Whether agreeing sends the client an invoice, which is what earns a confirmation. */
  billingEnabled: boolean
  onEdit: (contract: ContractDetail) => void
}) {
  const setStatus = useSetContractStatus()
  const [agreeing, agreeModal] = useDisclosure(false)
  const editable = isEditable(contract.status)
  const next = CONTRACT_TRANSITIONS[contract.status]
  const agreed = contract.status === 'active' || contract.status === 'paused'
  const pendingStatus = setStatus.isPending ? setStatus.variables?.status : undefined

  function change(status: ContractStatus) {
    if (billingEnabled && contract.status === 'sent' && status === 'active') {
      agreeModal.open()
      return
    }
    setStatus.mutate({ contractId: contract.id, status })
  }

  return (
    <Stack gap="lg">
      <Group gap="sm" wrap="wrap">
        <Badge color={CONTRACT_STATUS_COLORS[contract.status]} variant="light" size="lg">
          {CONTRACT_STATUS_LABELS[contract.status]}
        </Badge>
        {contract.isBilled ? (
          <Badge
            color="brand"
            variant="outline"
            size="lg"
            leftSection={<IconReceipt size={14} aria-hidden />}
          >
            Billed in Stripe
          </Badge>
        ) : null}
        <Text size="sm" c="dimmed">
          {contract.clientName} · {BILLING_CYCLE_LABELS[contract.billingCycle]}
        </Text>
      </Group>

      {agreed && !contract.isBilled ? (
        <Text size="sm" c="dimmed">
          {billingEnabled
            ? 'Agreed before billing was set up, so Stripe is not invoicing this contract.'
            : 'Billing is not set up for this portal, so this contract is not invoiced.'}
        </Text>
      ) : null}

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
              loading={pendingStatus === status}
              // A second transition racing the first would reach Stripe out of order.
              disabled={pendingStatus !== undefined && pendingStatus !== status}
              onClick={() => change(status)}
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

      <AgreeContractModal
        contract={contract}
        opened={agreeing}
        onClose={agreeModal.close}
        onConfirm={() => setStatus.mutate({ contractId: contract.id, status: 'active' })}
      />

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
