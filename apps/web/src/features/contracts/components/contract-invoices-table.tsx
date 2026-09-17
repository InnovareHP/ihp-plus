import { Alert, Anchor, Badge, Button, Skeleton, Stack, Table, Text } from '@mantine/core'
import { formatCents, type ContractInvoiceRow } from '../schema'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

const STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'green' },
  open: { label: 'Awaiting payment', color: 'blue' },
  draft: { label: 'Draft', color: 'gray' },
  void: { label: 'Void', color: 'gray' },
  uncollectible: { label: 'Uncollectible', color: 'red' },
}

// An open invoice with a failed attempt is the one a manager needs to chase, so it reads as such.
function statusOf(invoice: ContractInvoiceRow) {
  if (invoice.status === 'open' && invoice.failedAt) {
    return { label: 'Payment failed', color: 'red' }
  }
  return STATUS[invoice.status] ?? { label: invoice.status, color: 'gray' }
}

export interface ContractInvoicesTableProps {
  invoices: readonly ContractInvoiceRow[] | undefined
  isPending: boolean
  errorMessage: string | undefined
  onRetry: () => void
}

export function ContractInvoicesTable({
  invoices,
  isPending,
  errorMessage,
  onRetry,
}: ContractInvoicesTableProps) {
  if (isPending) {
    return (
      <Stack gap="xs" aria-busy="true">
        <Skeleton height={36} />
        <Skeleton height={36} />
      </Stack>
    )
  }

  if (errorMessage) {
    return (
      <Stack gap="xs">
        <Alert role="alert" color="red" variant="light" title="Could not load invoices">
          <Text size="sm">{errorMessage}</Text>
        </Alert>
        <Button variant="default" w="fit-content" onClick={onRetry}>
          Try again
        </Button>
      </Stack>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No invoices yet. Stripe sends the first one on the billing date, and it appears here.
      </Text>
    )
  }

  return (
    <Table.ScrollContainer minWidth={520}>
      <Table withTableBorder verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Issued</Table.Th>
            <Table.Th scope="col">Status</Table.Th>
            <Table.Th scope="col">Amount</Table.Th>
            <Table.Th scope="col">Invoice</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {invoices.map((invoice) => {
            const status = statusOf(invoice)
            const issued = date.format(new Date(invoice.createdAt))

            return (
              <Table.Tr key={invoice.id}>
                <Table.Th scope="row" fw={400}>
                  <Text size="sm">{issued}</Text>
                </Table.Th>
                <Table.Td>
                  <Stack gap={2} align="flex-start">
                    <Badge color={status.color} variant="light">
                      {status.label}
                    </Badge>
                    {invoice.failureReason ? (
                      <Text size="xs" c="dimmed">
                        {invoice.failureReason}
                      </Text>
                    ) : null}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatCents(
                      invoice.status === 'paid' ? invoice.amountPaidCents : invoice.amountDueCents,
                    )}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {invoice.hostedInvoiceUrl ? (
                    <Anchor
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      aria-label={`View the invoice issued ${issued} (opens in a new tab)`}
                    >
                      View
                    </Anchor>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Not issued yet
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
