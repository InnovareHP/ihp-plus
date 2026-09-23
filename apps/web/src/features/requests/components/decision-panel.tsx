'use client'

import { Stack } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import { announceSuccess } from '@/lib/announce'
import { useDecideOne } from '../hooks/use-requests'
import type { RequestRow } from '../schema'
import { DecisionFields } from './decision-fields'

export function DecisionPanel({ row }: { row: RequestRow }) {
  const decide = useDecideOne()

  return (
    <PageSection
      title="Your decision"
      description="The requester sees the outcome and your note straight away."
    >
      <Stack>
        <DecisionFields
          label="request"
          isPending={decide.isPending}
          onDecide={(decision, note) =>
            decide.mutate(
              { submissionId: row.id, decision, note },
              {
                onSuccess: (updated) =>
                  announceSuccess(
                    `${updated.formName} ${updated.status === 'approved' ? 'approved' : 'rejected'}.`,
                  ),
              },
            )
          }
        />
      </Stack>
    </PageSection>
  )
}
