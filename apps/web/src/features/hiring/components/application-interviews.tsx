'use client'

import { Button, Stack, Text } from '@mantine/core'
import { IconCalendarPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { PageSection } from '@/components/page-section'
import { announceFailure } from '@/lib/announce'
import { useCancelInterview } from '../hooks/use-interviews'
import type { ApplicationSummary, InterviewRow } from '../schema'
import { InterviewCard } from './interview-card'
import { ScheduleInterviewModal } from './schedule-interview-modal'

export interface ApplicationInterviewsProps {
  application: ApplicationSummary
  interviews: readonly InterviewRow[]
  timeZone: string
}

export function ApplicationInterviews({
  application,
  interviews,
  timeZone,
}: ApplicationInterviewsProps) {
  const cancel = useCancelInterview()
  // Ephemeral dialog state; the offer itself lives on the server once sent.
  const [scheduling, setScheduling] = useState(false)
  const canSchedule = application.status === 'active'

  return (
    <PageSection
      title="Interviews"
      description={`Times are shown in ${timeZone}.`}
      actions={
        canSchedule ? (
          <Button
            variant="default"
            leftSection={<IconCalendarPlus size={16} aria-hidden />}
            onClick={() => setScheduling(true)}
          >
            Schedule interview
          </Button>
        ) : null
      }
    >
      {interviews.length === 0 ? (
        <Text size="sm" c="dimmed">
          {canSchedule
            ? 'Offer a few times and they pick the one that suits them from their status page.'
            : 'No interviews were held.'}
        </Text>
      ) : (
        <Stack gap="sm">
          {interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              applicantName={application.fullName}
              timeZone={timeZone}
              isCancelling={cancel.isPending && cancel.variables === interview.id}
              onCancel={() =>
                cancel.mutate(interview.id, { onError: (error) => announceFailure(error.message) })
              }
              onOfferNewTimes={() => setScheduling(true)}
            />
          ))}
        </Stack>
      )}

      {scheduling ? (
        <ScheduleInterviewModal
          application={application}
          timeZone={timeZone}
          onClose={() => setScheduling(false)}
        />
      ) : null}
    </PageSection>
  )
}
