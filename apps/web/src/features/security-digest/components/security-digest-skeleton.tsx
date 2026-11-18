import { Grid, Skeleton, Stack } from '@mantine/core'

export function SecurityDigestSkeleton() {
  return (
    <Grid gap="lg" aria-busy="true" aria-label="Loading security emails">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap="xs">
          <Skeleton height={36} width="12rem" />
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} height={92} radius="md" />
          ))}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Skeleton height={520} radius="md" />
      </Grid.Col>
    </Grid>
  )
}
