'use client'

import { SegmentedControl, Stack, Tabs } from '@mantine/core'
import { z } from 'zod'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import { usePosting } from '../hooks/use-postings'
import { applicationQuerySchema, type PostingRow, type Stage } from '../schema'
import { ApplicationsTable } from './applications-table'
import { PipelineBoard } from './pipeline-board'
import { PostingEditor } from './posting-editor'

const workspaceQuerySchema = applicationQuerySchema.extend({
  tab: z.enum(['pipeline', 'details']).catch('pipeline').default('pipeline'),
  view: z.enum(['board', 'list']).catch('board').default('board'),
})

type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>

const DEFAULT_WORKSPACE_QUERY: WorkspaceQuery = workspaceQuerySchema.parse({})
const parseWorkspaceQuery = searchParamsParser(workspaceQuerySchema)

export interface PostingWorkspaceProps {
  posting: PostingRow
  defaultStages: readonly Stage[]
  rejectionMessage: string
}

// The tab, the board-or-list choice and the list's filters are all URL state, so a link lands
// exactly where it was copied from.
export function PostingWorkspace({
  posting,
  defaultStages,
  rejectionMessage,
}: PostingWorkspaceProps) {
  const { query, setQuery } = useUrlQuery(parseWorkspaceQuery, DEFAULT_WORKSPACE_QUERY)
  // Seeded from the server render, then kept fresh by the same cache the editor writes to.
  const current = usePosting(posting.id, posting).data ?? posting

  return (
    <Tabs
      value={query.tab}
      onChange={(value) => setQuery({ tab: value === 'details' ? 'details' : 'pipeline' })}
      keepMounted={false}
    >
      <Tabs.List mb="lg">
        <Tabs.Tab value="pipeline">Pipeline ({current.activeCount})</Tabs.Tab>
        <Tabs.Tab value="details">Posting details</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="pipeline">
        <Stack gap="md">
          <SegmentedControl
            w="fit-content"
            aria-label="How to show the applicants"
            value={query.view}
            onChange={(value) => setQuery({ view: value === 'list' ? 'list' : 'board' })}
            data={[
              { value: 'board', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
          {query.view === 'board' ? (
            <PipelineBoard posting={current} rejectionMessage={rejectionMessage} />
          ) : (
            <ApplicationsTable
              query={query}
              setQuery={setQuery}
              // One patch, not a reset: clearing the filters must keep the tab and the view.
              clearFilters={() => setQuery({ search: '', status: 'active', stageId: '', page: 1 })}
              rejectionMessage={rejectionMessage}
              posting={{ id: current.id, stages: current.stages }}
            />
          )}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="details">
        <PostingEditor posting={current} defaultStages={defaultStages} />
      </Tabs.Panel>
    </Tabs>
  )
}
