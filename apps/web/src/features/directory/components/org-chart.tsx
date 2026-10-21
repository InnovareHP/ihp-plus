import { Card, SimpleGrid, Spoiler, Stack, Text, Title } from '@mantine/core'
import { EmptyState } from '@/components/empty-state'
import touch from '@/components/touch-target.module.css'
import type { OrgChart as OrgChartData } from '../schema'
import { ChartPeople } from './chart-people'

export function OrgChart({ chart }: { chart: OrgChartData }) {
  if (chart.departments.length === 0) {
    return (
      <EmptyState
        title="No departments are set up yet"
        description="An admin adds them on the organization page, and each one appears here with its leads and team."
      />
    )
  }

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        {chart.organizationName} · {chart.departments.length}{' '}
        {chart.departments.length === 1 ? 'department' : 'departments'}
        {chart.unassignedCount > 0
          ? ` · ${chart.unassignedCount} ${chart.unassignedCount === 1 ? 'person has' : 'people have'} no department yet`
          : ''}
      </Text>

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
        {chart.departments.map((department) => {
          const headingId = `department-${department.teamId}`
          const size = department.leads.length + department.members.length

          return (
            <Card
              key={department.teamId}
              component="section"
              padding="lg"
              aria-labelledby={headingId}
            >
              <Title order={2} size="h5" id={headingId}>
                {department.name}
              </Title>
              <Text size="xs" c="dimmed" mb="sm">
                {size} {size === 1 ? 'person' : 'people'}
              </Text>

              <Title order={3} size="h6">
                Leads
              </Title>
              <ChartPeople people={department.leads} emphasis emptyText="No lead appointed." />

              <Title order={3} size="h6" mt="sm">
                Team
              </Title>
              {/* A big department collapses so one card does not push the rest a screen away. */}
              <Spoiler
                maxHeight={200}
                showLabel="Show all"
                hideLabel="Show less"
                showAriaLabel={`Show all of ${department.name}`}
                hideAriaLabel={`Show less of ${department.name}`}
                classNames={{ control: touch.target }}
                attributes={{ content: { 'aria-label': `${department.name} team` } }}
              >
                <ChartPeople
                  people={department.members}
                  emptyText="No one else is in this department yet."
                />
              </Spoiler>
            </Card>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
