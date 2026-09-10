import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MembersTable } from '@/features/members/components/members-table'
import { membershipOf, requireOnboarded } from '@/lib/auth-guard'

export const metadata: Metadata = { title: 'Members' }

export default async function MembersPage() {
  const { profile } = await requireOnboarded()
  const membership = membershipOf(profile)

  // Not a redirect: an ordinary member should not learn that this route exists.
  const canManage =
    membership.portalRole === 'admin' ||
    membership.organizationRole === 'owner' ||
    membership.organizationRole === 'admin'
  if (!canManage) notFound()

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h2">
          Members
        </Title>
        <Text c="dimmed">
          Organization roles cover this company; the portal role decides who can manage everyone.
        </Text>
      </Stack>
      <MembersTable />
    </Stack>
  )
}
