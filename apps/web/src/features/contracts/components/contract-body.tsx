'use client'

import { Badge, Button, CopyButton, Group, Stack, Text, TextInput, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPencil, IconReceipt } from '@tabler/icons-react'
import { track } from '@/lib/analytics'
import { contractEvents } from '../events'
import {
  BILLING_CYCLE_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_TRANSITIONS,
  CONTRACT_TRANSITION_LABELS,
  isEditable,
  type ContractDetail,
  type ContractStatus,
} from '../schema'
import { useContractInvoices, useSetContractStatus } from '../use-contracts'
import { AgreeContractModal } from './agree-contract-modal'
import { ContractInvoicesTable } from './contract-invoices-table'
import { ContractLinesTable } from './contract-lines-table'

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
  const invoices = useContractInvoices(contract.id, contract.isBilled)
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

      {contract.clientLink ? (
        <Stack gap="xs">
          <Title order={3} size="h6">
            Client link
          </Title>
          <Text size="sm" c="dimmed">
            Emailed to the client when it was published.{' '}
            {contract.viewedAt
              ? `They opened it on ${date.format(new Date(contract.viewedAt))}.`
              : 'They have not opened it yet.'}
          </Text>
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              label="Link to send by hand"
              value={contract.clientLink}
              readOnly
              flex={1}
              onFocus={(event) => event.currentTarget.select()}
            />
            <CopyButton value={contract.clientLink}>
              {({ copied, copy }) => (
                <Button
                  variant="default"
                  onClick={() => {
                    copy()
                    track(contractEvents.clientLinkCopied)
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      ) : null}

      <Stack gap="xs">
        <Title order={3} size="h6">
          Services
        </Title>
        <ContractLinesTable lines={contract.lines} subtotalCents={contract.subtotalCents} />
      </Stack>

      {contract.isBilled ? (
        <Stack gap="xs">
          <Title order={3} size="h6">
            Invoices
          </Title>
          <ContractInvoicesTable
            invoices={invoices.data}
            isPending={invoices.isPending}
            errorMessage={invoices.error?.message}
            onRetry={() => invoices.refetch()}
          />
        </Stack>
      ) : null}

      <Stack gap={4}>
        <Title order={3} size="h6">
          Dates
        </Title>
        <Text size="sm" c="dimmed">
          Starts {contract.startDate ? date.format(new Date(contract.startDate)) : 'not set'} · Ends{' '}
          {contract.endDate ? date.format(new Date(contract.endDate)) : 'open-ended'}
          {contract.signedAt ? ` · Agreed ${date.format(new Date(contract.signedAt))}` : ''}
          {contract.acceptedByName ? ` online by ${contract.acceptedByName}` : ''}
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
