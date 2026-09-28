import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/empty-state'
import { CareersPostingCard } from '@/features/hiring/components/careers-posting-card'
import { loadCareers } from '@/features/hiring/public-service'

// Openings change whenever HR publishes one, so the list is read per request, never baked at build.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Open roles and how to apply.',
}

export default async function CareersPage() {
  const careers = await loadCareers()
  if (!careers) notFound()

  return (
    <Stack gap="xl" maw={880} mx="auto">
      <Stack gap="xs">
        <Title order={1}>Careers at {careers.organizationName}</Title>
        <Text c="dimmed" maw="60ch">
          Every opening we are hiring for right now. Pick one to read the whole role and apply — it
          takes a few minutes, and you can check where your application stands at any time.
        </Text>
      </Stack>

      {careers.postings.length === 0 ? (
        <EmptyState
          title="No openings right now"
          description="We post every new role here first. Check back soon."
        />
      ) : (
        <Stack gap="md" component="section" aria-label="Open roles">
          <Text size="sm" c="dimmed">
            {careers.postings.length} {careers.postings.length === 1 ? 'opening' : 'openings'}
          </Text>
          {careers.postings.map((posting) => (
            <CareersPostingCard key={posting.slug} posting={posting} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
