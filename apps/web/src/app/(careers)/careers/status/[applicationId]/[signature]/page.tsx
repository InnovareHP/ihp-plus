import { Paper, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { LinkAnchor } from '@/components/link-anchor'
import { ApplicationStatusCard } from '@/features/hiring/components/application-status-card'
import { InterviewPicker } from '@/features/hiring/components/interview-picker'
import { loadInterviewOffers } from '@/features/hiring/public-interview-service'
import { loadApplicationStatus } from '@/features/hiring/public-service'
import { routes } from '@/lib/routes'

// A signed link is a credential, so it must never be indexed or followed from a search result.
export const metadata: Metadata = {
  title: 'Your application',
  robots: { index: false, follow: false },
}

export default async function ApplicationStatusPage({
  params,
}: {
  params: Promise<{ applicationId: string; signature: string }>
}) {
  const { applicationId, signature } = await params
  const application = await loadApplicationStatus(applicationId, signature)

  if (!application) {
    return (
      <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }} maw={720} mx="auto">
        <Stack gap="sm">
          <Title order={1} size="h3">
            This link is not valid
          </Title>
          <Text size="sm" c="dimmed">
            It may have been mistyped or cut short. Open it again from the confirmation email we
            sent when you applied.
          </Text>
          <LinkAnchor href={routes.careers} size="sm" w="fit-content">
            See the roles that are open
          </LinkAnchor>
        </Stack>
      </Paper>
    )
  }

  // Only a live application has an interview worth acting on.
  const offers = application.status === 'active' ? await loadInterviewOffers(application.id) : []

  return (
    <Stack maw={720} mx="auto">
      {offers.map((offer) => (
        <InterviewPicker
          key={offer.id}
          offer={offer}
          applicationId={application.id}
          signature={signature}
        />
      ))}
      <ApplicationStatusCard application={application} signature={signature} />
    </Stack>
  )
}
