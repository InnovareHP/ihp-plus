'use client'

import { Skeleton, Stack } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import type { DayRange } from '../days'
import { useSaveTakeaways, useTakeaways } from '../hooks/use-takeaways'
import { EMPTY_TAKEAWAYS } from '../schema'
import type { ReportSite } from '../sites'
import { ReportError } from './report-error'
import { TakeawaysForm } from './takeaways-form'

export function TakeawaysPanel({ site, range }: { site: ReportSite; range: DayRange }) {
  const saved = useTakeaways(site.key, range)
  const save = useSaveTakeaways(site.key, range)

  return (
    <PageSection
      title="Takeaways"
      description={`What the numbers mean for the client. Saved for ${site.name} and these dates, and printed in the PDF.`}
    >
      {saved.isPending ? (
        <Stack gap="md" role="status" aria-busy="true" aria-label="Loading the takeaways">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} height={96} radius="sm" />
          ))}
        </Stack>
      ) : saved.isError ? (
        <ReportError
          message={saved.error.message}
          retrying={saved.isFetching}
          onRetry={() => saved.refetch()}
        />
      ) : (
        <TakeawaysForm
          initial={saved.data ?? EMPTY_TAKEAWAYS}
          savedAt={saved.data?.updatedAt ?? null}
          onSave={async (values) => {
            try {
              await save.mutateAsync(values)
              return null
            } catch (error) {
              return error instanceof Error ? error.message : 'The takeaways were not saved.'
            }
          }}
        />
      )}
    </PageSection>
  )
}
