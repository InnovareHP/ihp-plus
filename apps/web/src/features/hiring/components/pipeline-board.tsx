'use client'

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import { LinkButton } from '@/components/link-button'
import { careersPostingRoute } from '@/lib/routes'
import { useApplicationDecisions } from '../hooks/use-application-decisions'
import { usePipeline } from '../hooks/use-applications'
import type { PostingRow } from '../schema'
import { ApplicantCard } from './applicant-card'
import { ApplicationActionsMenu } from './application-actions-menu'
import { DecisionModals } from './decision-modals'

const GRID = { base: 1, sm: 2, lg: 3, xl: 4 }

export interface PipelineBoardProps {
  posting: PostingRow
  rejectionMessage: string
}

export function PipelineBoard({ posting, rejectionMessage }: PipelineBoardProps) {
  const pipeline = usePipeline(posting.id)
  const decisions = useApplicationDecisions()

  if (pipeline.isPending) {
    return (
      <SimpleGrid cols={GRID} spacing="md" aria-busy="true">
        {posting.stages.map((stage) => (
          <Skeleton key={stage.id} height={220} radius="md" />
        ))}
      </SimpleGrid>
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
      <SimpleGrid cols={GRID} spacing="md" opacity={pipeline.isFetching ? 0.7 : undefined}>
        {posting.stages.map((stage) => {
          const here = pipeline.data.filter((row) => row.stageId === stage.id)
          const headingId = `stage-${stage.id}`
          return (
            <Card
              key={stage.id}
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
      </SimpleGrid>
      <DecisionModals decisions={decisions} rejectionMessage={rejectionMessage} />
    </>
  )
}
