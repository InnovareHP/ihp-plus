'use client'

import { Alert, Badge, Button, Grid, Group, Menu, Stack, Text } from '@mantine/core'
import { IconArrowBackUp, IconChevronDown, IconMail } from '@tabler/icons-react'
import { ActivityTimeline } from '@/components/activity-timeline'
import { FormAnswers } from '@/components/form-answers'
import { PageSection } from '@/components/page-section'
import { applicationFileHref } from '@/lib/routes'
import { useApplicationDecisions } from '../hooks/use-application-decisions'
import { useAddNote, useApplication, useDeleteNoteWithUndo } from '../hooks/use-applications'
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  type ApplicationDetail,
} from '../schema'
import { ApplicantContact } from './applicant-contact'
import { ApplicationFiles } from './application-files'
import { ApplicationNotes } from './application-notes'
import { DecisionModals } from './decision-modals'
import { NoteComposer } from './note-composer'

export interface ApplicationDetailViewProps {
  application: ApplicationDetail
  rejectionMessage: string
  /** The signed-in person, named on a note while it is still being saved. */
  viewerName: string
}

export function ApplicationDetailView({
  application: initial,
  rejectionMessage,
  viewerName,
}: ApplicationDetailViewProps) {
  const query = useApplication(initial.summary.id, initial)
  const application = query.data ?? initial
  const { summary } = application
  const decisions = useApplicationDecisions()
  const addNote = useAddNote(viewerName)
  const deleteNote = useDeleteNoteWithUndo(summary.id)
  const targets = application.stages.filter((stage) => stage.id !== summary.stageId)

  // A file answer links to its upload, found by the question it answered.
  const fileIds = new Map(application.files.map((file) => [file.fieldId, file.id]))
  const fileHref = (fieldId: string) => {
    const id = fileIds.get(fieldId)
    return id ? applicationFileHref(id) : ''
  }

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="xs">
          <Badge color={APPLICATION_STATUS_COLORS[summary.status]} variant="light" size="lg">
            {APPLICATION_STATUS_LABELS[summary.status]}
          </Badge>
          {summary.status === 'active' ? <Text size="sm">Stage: {summary.stageName}</Text> : null}
        </Group>

        <Group gap="sm">
          {summary.status === 'active' && targets.length > 0 ? (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button rightSection={<IconChevronDown size={16} aria-hidden />}>
                  Move to a stage
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {targets.map((stage) => (
                  <Menu.Item
                    key={stage.id}
                    rightSection={
                      stage.message ? (
                        <IconMail size={14} aria-label="Emails the applicant" />
                      ) : null
                    }
                    onClick={() => decisions.requestMove(summary, stage)}
                  >
                    {stage.name}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          ) : null}
          {summary.status === 'active' ? (
            <Button variant="subtle" color="red" onClick={() => decisions.requestReject(summary)}>
              Not moving forward
            </Button>
          ) : null}
          {summary.status === 'rejected' ? (
            <Button
              variant="default"
              leftSection={<IconArrowBackUp size={16} aria-hidden />}
              onClick={() => decisions.reopen(summary)}
            >
              Reopen
            </Button>
          ) : null}
        </Group>
      </Group>

      {summary.status === 'rejected' && application.rejectionReason ? (
        <Alert color="gray" variant="light" title="Why the team passed">
          <Text size="sm">{application.rejectionReason}</Text>
        </Alert>
      ) : null}

      <Grid gap="xl">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="xl">
            <PageSection title="Contact">
              <ApplicantContact application={summary} />
            </PageSection>
            <PageSection title="Files">
              <ApplicationFiles files={application.files} fields={application.fields} />
            </PageSection>
            <PageSection title="Answers" description="As they were asked when this person applied.">
              {application.fields.length === 0 ? (
                <Text size="sm" c="dimmed">
                  This posting asked no extra questions.
                </Text>
              ) : (
                <FormAnswers
                  fields={application.fields}
                  values={application.values}
                  fileHref={fileHref}
                />
              )}
            </PageSection>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="xl">
            <PageSection title="Notes">
              <Stack gap="md">
                <ApplicationNotes
                  notes={application.notes}
                  onDelete={(note) => void deleteNote(note)}
                />
                <NoteComposer
                  applicationId={summary.id}
                  onAdd={(values) => addNote.mutate(values)}
                />
              </Stack>
            </PageSection>
            <PageSection title="History">
              <ActivityTimeline
                label={`History of ${summary.fullName}'s application`}
                items={application.events.map((event) => ({
                  ...event,
                  actorName: event.actorName ?? 'The applicant',
                }))}
              />
            </PageSection>
          </Stack>
        </Grid.Col>
      </Grid>

      <DecisionModals decisions={decisions} rejectionMessage={rejectionMessage} />
    </Stack>
  )
}
