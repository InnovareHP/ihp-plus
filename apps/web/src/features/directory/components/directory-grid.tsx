'use client'

import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import { IconMail, IconPhone } from '@tabler/icons-react'
import { TableToolbar, type FilterControl } from '@/components/table-toolbar'
import { EmptyState } from '@/components/page-shell'
import { pageRangeOf } from '@/lib/pagination'
import { initialsOf, isFilteredDirectoryQuery, UNASSIGNED, type PersonRow } from '../schema'
import { useDirectory, useDirectoryDepartments } from '../use-directory'
import { useDirectoryQuery } from '../use-directory-query'

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

function PersonCard({ person }: { person: PersonRow }) {
  return (
    <Card component="article" padding="md" withBorder>
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Avatar src={person.photoUrl || undefined} size={56} radius="md" alt="">
            {initialsOf(person.name)}
          </Avatar>
          <Stack gap={2} miw={0}>
            <Group gap={6} wrap="nowrap">
              <Text fw={600} lineClamp={1}>
                {person.name}
              </Text>
              {person.isLead ? (
                <Badge size="xs" variant="light">
                  Lead
                </Badge>
              ) : null}
            </Group>
            <Text size="sm" c="dimmed" lineClamp={2}>
              {person.jobTitle || 'No job title'}
            </Text>
            <Text size="xs" c="dimmed">
              {person.department || 'No department'}
            </Text>
          </Stack>
        </Group>

        <Stack gap={4}>
          <Group gap={6} wrap="nowrap">
            <IconMail size={14} aria-hidden />
            {/* mailto rather than plain text: a directory is for getting in touch. */}
            <Anchor href={`mailto:${person.email}`} size="sm" lineClamp={1}>
              {person.email}
            </Anchor>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconPhone size={14} aria-hidden />
            {person.phone ? (
              <Anchor href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} size="sm">
                {person.phone}
              </Anchor>
            ) : (
              <Text size="sm" c="dimmed">
                No phone
              </Text>
            )}
          </Group>
        </Stack>

        {person.ihpId ? (
          <Text size="xs" c="dimmed" ff="monospace">
            {person.ihpId}
          </Text>
        ) : null}
      </Stack>
    </Card>
  )
}

function DirectoryFooter({
  pageInfo,
  onPageChange,
}: {
  pageInfo: { page: number; pageSize: number; total: number; pageCount: number }
  onPageChange: (page: number) => void
}) {
  const range = pageRangeOf({ ...pageInfo, hasPrevious: false, hasNext: false })

  return (
    <Group justify="space-between" wrap="wrap" gap="sm">
      <Text size="sm" c="dimmed" aria-live="polite">
        Showing {range.from}–{range.to} of {pageInfo.total}
      </Text>
      {pageInfo.pageCount > 1 ? (
        <Pagination
          total={pageInfo.pageCount}
          value={pageInfo.page}
          onChange={onPageChange}
          size="sm"
          getItemProps={(page) => ({ 'aria-label': `Page ${page}` })}
        />
      ) : null}
    </Group>
  )
}

// The same card shape as the loaded grid, so nothing shifts when the people land.
function DirectorySkeleton() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md" aria-busy="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((card) => (
        <Skeleton key={card} height={196} radius="md" />
      ))}
    </SimpleGrid>
  )
}
