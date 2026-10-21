'use client'

import { Alert, Badge, Box, Button, Card, Group, Skeleton, Stack, Text, Title } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import { LinkButton } from '@/components/link-button'
import { careersPostingRoute } from '@/lib/routes'
import { useApplicationDecisions } from '../hooks/use-application-decisions'
import { usePipeline } from '../hooks/use-applications'
import type { PostingRow } from '../schema'
import { ApplicantCard } from './applicant-card'
import { ApplicationActionsMenu } from './application-actions-menu'
import { DecisionModals } from './decision-modals'
import classes from './pipeline-board.module.css'

export interface PipelineBoardProps {
  posting: PostingRow
  rejectionMessage: string
}

export function PipelineBoard({ posting, rejectionMessage }: PipelineBoardProps) {
  const pipeline = usePipeline(posting.id)
  const decisions = useApplicationDecisions()

  if (pipeline.isPending) {
    return (
      <>
        {/* Holds the "Updating…" line's space, so the board does not drop when it lands. */}
        <Skeleton height={16} width="5rem" mb="xs" />
        <Box className={classes.board} aria-busy="true">
          {posting.stages.map((stage) => (
            <Skeleton key={stage.id} height={220} radius="md" className={classes.column} />
          ))}
        </Box>
      </>
    )
  }

  if (pipeline.isError) {
    return (
      <Stack gap="md">
        <Alert role="alert" color="red" variant="light" title="Could not load the pipeline">
          <Text size="sm">{pipeline.error.message}</Text>
        </Alert>
        <Button onClick={() => pipeline.refetch()} w="fit-content">
          Try again
        </Button>
      </Stack>
    )
  }

  if (pipeline.data.length === 0) {
    return (
      <EmptyState
        title="Nobody in the pipeline yet"
        description={
          posting.status === 'open'
            ? 'Share the posting and new applications land in the first stage here.'
            : 'Publish the posting and new applications land in the first stage here.'
        }
        action={
          posting.status === 'open' ? (
            <LinkButton href={careersPostingRoute(posting.slug)} variant="default">
              View the public page
            </LinkButton>
          ) : undefined
        }
      />
    )
  }

  return (
    <>
      {/* Kept in the layout while hidden, so a background refetch shifts nothing under a click. */}
      <Text size="xs" c="dimmed" aria-hidden mb="xs" opacity={pipeline.isFetching ? 1 : 0}>
        Updating…
      </Text>
      <Box className={classes.board}>
        {posting.stages.map((stage, index) => {
          const here = pipeline.data.filter((row) => row.stageId === stage.id)
          const headingId = `stage-${stage.id}`
          const next = posting.stages[index + 1]
          return (
            <Card
              key={stage.id}
              className={classes.column}
              component="section"
              aria-labelledby={headingId}
              padding="md"
              bg="var(--mantine-color-default-hover)"
            >
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Title order={3} size="h6" id={headingId}>
                    {stage.name}
                  </Title>
                  <Badge
                    variant="light"
                    color="gray"
                    aria-label={`${here.length} in ${stage.name}`}
                  >
                    {here.length}
                  </Badge>
                </Group>
                {here.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Nobody here right now.
                  </Text>
                ) : (
                  <Stack component="ul" gap="xs" m={0} p={0} aria-labelledby={headingId}>
                    {here.map((application) => (
                      <ApplicantCard
                        key={application.id}
                        application={application}
                        nextStage={application.status === 'active' ? next : undefined}
                        onAdvance={(stage) => decisions.requestMove(application, stage)}
                        actions={
                          <ApplicationActionsMenu
                            application={application}
                            stages={posting.stages}
                            onMove={(target) => decisions.requestMove(application, target)}
                            onReject={() => decisions.requestReject(application)}
                            onReopen={() => decisions.reopen(application)}
                          />
                        }
                      />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          )
        })}
      </Box>
      <DecisionModals decisions={decisions} rejectionMessage={rejectionMessage} />
    </>
  )
}
