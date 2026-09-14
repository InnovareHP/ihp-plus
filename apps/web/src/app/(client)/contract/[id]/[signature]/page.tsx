import { Alert, Group, Paper, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { after } from 'next/server'
import { AcceptContractForm } from '@/features/contracts/components/accept-contract-form'
import { PrintContractButton } from '@/features/contracts/components/print-contract-button'
import { SharedContractDocument } from '@/features/contracts/components/shared-contract-document'
import { loadSharedContract, markSharedContractViewed } from '@/features/contracts/shared-contract'
import { getSession } from '@/lib/auth-guard'
import { isStripeConfigured } from '@/lib/stripe'

// A signed link is a credential, so it must never be indexed or followed from a search result.
export const metadata: Metadata = {
  title: 'Contract',
  robots: { index: false, follow: false },
}

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' })

export default async function SharedContractPage({
  params,
}: {
  params: Promise<{ id: string; signature: string }>
}) {
  const { id, signature } = await params
  const view = await loadSharedContract(id, signature)

  if (view.state === 'missing') {
    return (
      <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }}>
        <Stack gap="sm">
          <Title order={1} size="h3">
            This contract link is not valid
          </Title>
          <Text size="sm" c="dimmed">
            It may have been mistyped, or the contract changed after the link was sent. Ask your
            contact for a new link.
          </Text>
        </Stack>
      </Paper>
    )
  }

  const { contract } = view

  // A signed-in manager previewing the link is not the client opening it.
  if (view.state === 'open' && !(await getSession())) {
    after(() => markSharedContractViewed(contract.id))
  }

  return (
    <Stack gap="lg">
      {view.state === 'accepted' && contract.signedAt ? (
        <Alert color="green" variant="light" title="Accepted">
          <Text size="sm">
            {contract.acceptedByName
              ? `Accepted by ${contract.acceptedByName} on ${date.format(new Date(contract.signedAt))}.`
              : `Agreed on ${date.format(new Date(contract.signedAt))}.`}
          </Text>
        </Alert>
      ) : null}

      {view.state === 'withdrawn' ? (
        <Alert color="yellow" variant="light" title="No longer open">
          <Text size="sm">
            {contract.organizationName} withdrew this contract, so it can no longer be accepted.
          </Text>
        </Alert>
      ) : null}

      <Group justify="flex-end" data-print-hidden>
        <PrintContractButton />
      </Group>

      <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }}>
        <SharedContractDocument contract={contract} />
      </Paper>

      {view.state === 'open' ? (
        <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }} data-print-hidden>
          <Stack gap="sm">
            <Title order={2} size="h4">
              Accept this contract
            </Title>
            <Text size="sm" c="dimmed">
              You are signing for {contract.clientName}.
              {isStripeConfigured()
                ? contract.billingCycle === 'monthly'
                  ? ' Invoices arrive by email each month once you accept.'
                  : ' The invoice arrives by email once you accept.'
                : ''}
            </Text>
            <AcceptContractForm
              contractId={contract.id}
              signature={signature}
              clientName={contract.clientName}
            />
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  )
}
