'use client'

import { Alert, Button, SimpleGrid, Stack, Text } from '@mantine/core'
// Contract boilerplate is company configuration, so it is edited where the company is.
import { ContractTermsPanel } from '@/features/contracts/components/contract-terms-panel'
import { useOrganizationSummary } from '../hooks/use-organization'
import { OrganizationProfileForm } from './organization-profile-form'
import { OrganizationSkeleton } from './organization-skeleton'
import { StatCard } from './stat-card'

export function OrganizationPanel() {
  const summary = useOrganizationSummary()

  if (summary.isPending) return <OrganizationSkeleton />

  if (summary.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load this organization">
          <Text size="sm">{summary.error.message}</Text>
        </Alert>
        <Button onClick={() => summary.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <StatCard label="People" value={summary.data.memberCount} hint="Members of this company" />
        <StatCard
          label="Departments"
          value={summary.data.teamCount}
          hint="Teams you can assign to"
        />
        <StatCard
          label="Pending invitations"
          value={summary.data.pendingInvitationCount}
          hint="Sent and not yet accepted"
        />
        <StatCard
          label="Without a department"
          value={summary.data.unassignedCount}
          hint="They see no department on their dashboard"
        />
      </SimpleGrid>

      <OrganizationProfileForm
        key={summary.data.id}
        defaultValues={{
          name: summary.data.name,
          slug: summary.data.slug,
          logo: summary.data.logo,
        }}
      />

      <ContractTermsPanel />
    </>
  )
}
