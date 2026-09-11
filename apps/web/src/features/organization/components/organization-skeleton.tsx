import { Card, SimpleGrid, Skeleton, Stack, Title } from '@mantine/core'

export function OrganizationSkeleton() {
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" aria-busy="true">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} height={116} radius="md" />
        ))}
      </SimpleGrid>
      <Card padding="lg">
        <Title order={2} size="h5" mb="md">
          Company profile
        </Title>
        {/* Same shape as the loaded form: a paired row, then a full-width field. */}
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Skeleton height={60} />
            <Skeleton height={76} />
          </SimpleGrid>
          <Skeleton height={76} />
          <Skeleton height={36} width={140} />
        </Stack>
      </Card>
    </>
  )
}
