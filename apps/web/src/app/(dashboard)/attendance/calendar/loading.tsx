import { Card, Skeleton, Stack } from '@mantine/core'
import { PageShell } from '@/components/page-shell'

// Same header and grid heights as the loaded page, so nothing shifts.
export default function AttendanceCalendarLoading() {
  return (
    <PageShell>
      <Stack gap="sm" aria-busy="true">
        <Skeleton height={32} width="10rem" />
        <Skeleton height={20} width="30rem" />
      </Stack>
      <Card padding="lg">
        <Stack gap="xs">
          <Skeleton height={36} width="14rem" />
          <Skeleton height={36} />
          {[0, 1, 2, 3, 4].map((week) => (
            <Skeleton key={week} height={116} />
          ))}
        </Stack>
      </Card>
    </PageShell>
  )
}
