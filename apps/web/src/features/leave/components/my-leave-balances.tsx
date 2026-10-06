'use client'

import { Alert, Button, SimpleGrid, Skeleton } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import { LinkButton } from '@/components/link-button'
import { routes } from '@/lib/routes'
import { useMyBalances } from '../hooks/use-balances'
import { LeaveBalanceCard } from './leave-balance-card'

const GRID = { base: 1, xs: 2, lg: 3 }

export function MyLeaveBalances({ year }: { year: number | undefined }) {
  const balances = useMyBalances(year)

  if (balances.isPending) {
    return (
      <SimpleGrid cols={GRID} aria-busy="true">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} height={150} radius="md" />
        ))}
      </SimpleGrid>
    )
  }

  if (balances.isError) {
    return (
      <Alert color="red" title="Could not load your leave" role="alert">
        {balances.error.message} Check your connection and try again.
        <Button mt="sm" variant="light" color="red" onClick={() => void balances.refetch()}>
          Try again
        </Button>
      </Alert>
    )
  }

  if (balances.data.balances.length === 0) {
    return (
      <EmptyState
        title="No leave allowance yet"
        description="Once an admin sets a yearly allowance on a time off form for your department, your days left show here."
        action={
          <LinkButton href={routes.requests} variant="light">
            Go to my requests
          </LinkButton>
        }
      />
    )
  }

  return (
    <SimpleGrid cols={GRID} opacity={balances.isFetching ? 0.7 : 1}>
      {balances.data.balances.map((balance) => (
        <LeaveBalanceCard key={balance.formId} balance={balance} />
      ))}
    </SimpleGrid>
  )
}
