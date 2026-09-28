'use client'

import { Alert, Anchor, Badge, Grid, Group, Stack, Text } from '@mantine/core'
import { FormAnswers } from '@/components/form-answers'
import { PageSection } from '@/components/page-section'
import { applicationFileHref } from '@/lib/routes'
import { useInterviewerView } from '../hooks/use-scorecard'
import {
  INTERVIEW_FORMAT_LABELS,
  INTERVIEW_STATUS_COLORS,
  INTERVIEW_STATUS_LABELS,
  type InterviewerView,
} from '../schema'
import { formatInterviewTime } from '../utils/interview-time'
import { ApplicationFiles } from './application-files'
import { ScorecardForm } from './scorecard-form'

export function InterviewerWorkspace({ view: initial }: { view: InterviewerView }) {
  const view = useInterviewerView(initial.interview.id, initial).data ?? initial
  const { interview, applicant } = view
  const join = interview.joinUrl ?? (interview.format === 'video' ? interview.location : '')
  const fileIds = new Map(view.files.map((file) => [file.fieldId, file.id]))

  return (
    <Grid gap="xl">
      <Grid.Col span={{ base: 12, lg: 5 }}>
        <Stack gap="xl">
          <PageSection title="The interview">
            <Stack gap="xs">
              <Group gap="xs">
                <Badge color={INTERVIEW_STATUS_COLORS[interview.status]} variant="light">
                  {INTERVIEW_STATUS_LABELS[interview.status]}
                </Badge>
                <Text size="sm">
                  {INTERVIEW_FORMAT_LABELS[interview.format]} · {interview.durationMinutes} minutes
                </Text>
              </Group>
              {interview.bookedStart ? (
                <Text fw={600}>{formatInterviewTime(interview.bookedStart, view.timeZone)}</Text>
              ) : null}
              {interview.format === 'onsite' ? (
                <Text size="sm">At {interview.location}</Text>
              ) : null}
              {interview.format === 'phone' ? (
                <Text size="sm">
                  Ring {applicant.fullName}
                  {applicant.phone ? (
                    <>
                      {' on '}
                      <Anchor href={`tel:${applicant.phone}`} size="sm">
                        {applicant.phone}
                      </Anchor>
                    </>
                  ) : (
                    ' — no number was given, so reply to their email.'
                  )}
                </Text>
              ) : null}
              {join ? (
                <Anchor href={join} target="_blank" rel="noopener" size="sm" w="fit-content">
                  Join the call
                </Anchor>
              ) : null}
              <Text size="sm" c="dimmed">
                With {interview.interviewers.map((person) => person.name).join(', ')}
              </Text>
              {interview.note ? <Text size="sm">{interview.note}</Text> : null}
            </Stack>
          </PageSection>

          <PageSection title="Their files">
            <ApplicationFiles files={view.files} fields={view.applicationFields} />
          </PageSection>

          <PageSection title="What they told us">
            {view.applicationFields.length === 0 ? (
              <Text size="sm" c="dimmed">
                This posting asked no extra questions.
              </Text>
            ) : (
              <FormAnswers
                fields={view.applicationFields}
                values={view.applicationValues}
                fileHref={(fieldId) => {
                  const id = fileIds.get(fieldId)
                  return id ? applicationFileHref(id) : ''
                }}
              />
            )}
          </PageSection>
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 7 }}>
        <PageSection
          title="Your scorecard"
          description="Only HR and admins read scorecards. Fill it in while the interview is fresh."
        >
          {!view.canScore ? (
            <Text size="sm" c="dimmed">
              You are not on this interview, so there is no scorecard for you to fill in.
            </Text>
          ) : interview.status !== 'booked' ? (
            <Alert color="gray" variant="light">
              The scorecard opens once the interview is booked.
            </Alert>
          ) : (
            <ScorecardForm
              interviewId={interview.id}
              applicantName={applicant.fullName}
              fields={view.scorecardFields}
              mine={view.mine}
            />
          )}
        </PageSection>
      </Grid.Col>
    </Grid>
  )
}
