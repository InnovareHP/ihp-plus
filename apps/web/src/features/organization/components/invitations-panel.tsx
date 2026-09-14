'use client'

import { Stack } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import { InvitationsTable } from './invitations-table'
import { InviteForm } from './invite-form'

export function InvitationsPanel({ invitedBy }: { invitedBy: string }) {
  return (
    <Stack gap="md">
      <InviteForm invitedBy={invitedBy} />
      <PageSection
        title="Pending invitations"
        description="Invitations stay here until they are accepted, cancelled, or they expire."
      >
        <InvitationsTable />
      </PageSection>
    </Stack>
  )
}
