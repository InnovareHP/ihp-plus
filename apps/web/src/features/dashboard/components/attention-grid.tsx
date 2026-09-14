import { SimpleGrid, Stack, Text } from '@mantine/core'
import { LinkAnchor } from '@/components/link-anchor'
import { StatCard } from '@/components/stat-card'
import { clientTab, routes } from '@/lib/routes'
import type { DashboardSummary } from '../service'

export function AttentionGrid({ summary }: { summary: DashboardSummary }) {
  const counts = [
    summary.approvalsWaiting,
    summary.openRequests,
    summary.contractsAwaitingClient,
    summary.failedPayments,
  ]
  const nothingWaiting = counts.every((count) => !count)

  return (
    <Stack gap="sm">
      {nothingWaiting ? (
        <Text size="sm" c="dimmed">
          Nothing is waiting on you right now.
        </Text>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {summary.approvalsWaiting === null ? null : (
          <StatCard
            label="Waiting for your decision"
            value={summary.approvalsWaiting}
            hint={
              summary.approvalsWaiting === 0
                ? 'Your approvals queue is clear.'
                : 'Pending requests you can approve or turn down.'
            }
            action={
              <LinkAnchor href={routes.requestApprovals} size="sm">
                Open approvals
              </LinkAnchor>
            }
          />
        )}

        <StatCard
          label="Your open requests"
          value={summary.openRequests}
          hint="Raised by you and not decided yet."
          action={
            <LinkAnchor href={`${routes.requests}?status=pending`} size="sm">
              View your requests
            </LinkAnchor>
          }
        />

        {summary.contractsAwaitingClient === null ? null : (
          <StatCard
            label="Contracts waiting on clients"
            value={summary.contractsAwaitingClient}
            hint="Published and not accepted yet."
            action={
              <LinkAnchor href={`${clientTab('contracts')}&status=sent`} size="sm">
                View published contracts
              </LinkAnchor>
            }
          />
        )}

        {summary.failedPayments === null ? null : (
          <StatCard
            label="Failed payments"
            value={summary.failedPayments}
            hint={
              summary.failedPayments === 0
                ? 'Every attempted payment went through.'
                : 'Open invoices Stripe could not collect.'
            }
            action={
              <LinkAnchor href={`${clientTab('contracts')}&status=active`} size="sm">
                Review active contracts
              </LinkAnchor>
            }
          />
        )}
      </SimpleGrid>
    </Stack>
  )
}
