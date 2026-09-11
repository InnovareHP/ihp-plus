'use client'

import { Alert, Button, SimpleGrid, Stack, Text } from '@mantine/core'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { EmptyState } from '@/components/empty-state'
import { useDirectory, useDirectoryDepartments } from '../hooks/use-directory'
import { useDirectoryQuery } from '../hooks/use-directory-query'
import { isFilteredDirectoryQuery, UNASSIGNED } from '../schema'
import { DirectoryFooter } from './directory-footer'
import { DirectorySkeleton } from './directory-skeleton'
import { PersonCard } from './person-card'

export function DirectoryGrid() {
  const { query, setQuery, clearFilters } = useDirectoryQuery()
  const people = useDirectory(query)
  const departments = useDirectoryDepartments()

  const filters: readonly FilterControl[] = [
    {
      kind: 'multi',
      key: 'teamIds',
      label: 'Department',
      options: [
        ...(departments.data?.departments ?? []).map((department) => ({
          value: department.teamId,
          label: `${department.name} (${department.memberCount})`,
        })),
        ...(departments.data && departments.data.unassignedCount > 0
          ? [{ value: UNASSIGNED, label: `No department (${departments.data.unassignedCount})` }]
          : []),
      ],
    },
  ]

  return (
    <Stack gap="md">
      <TableToolbar
        label="the directory"
        query={query}
        setQuery={setQuery}
        clearFilters={clearFilters}
        filters={filters}
      />

      {people.isPending ? <DirectorySkeleton /> : null}

      {people.isError ? (
        <Stack gap="md">
          <Alert role="alert" color="red" variant="light" title="Could not load the directory">
            <Text size="sm">{people.error.message}</Text>
          </Alert>
          <Button onClick={() => people.refetch()} w="fit-content">
            Try again
          </Button>
        </Stack>
      ) : null}

      {people.data && people.data.rows.length === 0 ? (
        isFilteredDirectoryQuery(query) ? (
          <EmptyState
            title="Nobody matches these filters"
            description="Widen the search or clear the filters to see everyone again."
            action={
              <Button variant="default" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nobody has finished onboarding yet"
            description="People appear here once they complete their profile, so the directory shows a real person rather than a blank card."
          />
        )
      ) : null}

      {people.data && people.data.rows.length > 0 ? (
        <Stack gap="md">
          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: 3, xl: 4 }}
            spacing="md"
            // A background refetch dims the grid rather than replacing it with a skeleton.
            opacity={people.isPlaceholderData ? 0.6 : undefined}
            aria-busy={people.isPlaceholderData || undefined}
          >
            {people.data.rows.map((person) => (
              <PersonCard key={person.userId} person={person} />
            ))}
          </SimpleGrid>

          <DirectoryFooter
            pageInfo={people.data.pageInfo}
            onPageChange={(page) => setQuery({ page })}
          />
        </Stack>
      ) : null}
    </Stack>
  )
}
