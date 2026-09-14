import { Stack, Text, Title } from '@mantine/core'
import type { SharedContract } from '../shared-contract'
import { ContractLinesTable } from './contract-lines-table'

const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export function SharedContractDocument({ contract }: { contract: SharedContract }) {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          {contract.organizationName} · Contract {contract.reference}
        </Text>
        <Title order={1} size="h2">
          {contract.title}
        </Title>
        <Text size="sm" c="dimmed">
          Prepared for {contract.clientName} · Billed{' '}
          {contract.billingCycle === 'monthly' ? 'monthly' : 'once'}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={2} size="h5">
          Services
        </Title>
        <ContractLinesTable lines={contract.lines} subtotalCents={contract.subtotalCents} />
      </Stack>

      <Stack gap={4}>
        <Title order={2} size="h5">
          Dates
        </Title>
        <Text size="sm">
          Starts {contract.startDate ? date.format(new Date(contract.startDate)) : 'on acceptance'}{' '}
          · Ends{' '}
          {contract.endDate ? date.format(new Date(contract.endDate)) : 'when either side ends it'}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={2} size="h5">
          Scope and terms
        </Title>
        {contract.terms ? (
          // Preserved as written: the composed terms carry their own line breaks.
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {contract.terms}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            No additional terms.
          </Text>
        )}
      </Stack>
    </Stack>
  )
}
