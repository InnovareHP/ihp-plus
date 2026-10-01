import { Alert, Divider, Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { LinkAnchor } from '@/components/link-anchor'
import { ApplicationForm } from '@/features/hiring/components/application-form'
import { PostingDescription } from '@/features/hiring/components/posting-description'
import { PostingMeta } from '@/features/hiring/components/posting-meta'
import { jobPostingLd } from '@/features/hiring/utils/job-posting-ld'
import { loadPublicPosting } from '@/features/hiring/public-service'
import { portalUrl } from '@/lib/email'
import { careersPostingRoute, routes } from '@/lib/routes'

const dateOnly = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

// cache() dedupes the read between the metadata and the page of one request.
const postingFor = cache(loadPublicPosting)

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const found = await postingFor(slug)
  if (!found) return { title: 'Role not found' }

  return {
    title: `${found.posting.title} · Careers`,
    description: found.posting.summary || `Apply for ${found.posting.title}.`,
    // A closed role stays reachable for people who bookmarked it, but should leave search results.
    robots: found.posting.isOpen ? undefined : { index: false },
  }
}

export default async function CareersPostingPage({ params }: Params) {
  const { slug } = await params
  const found = await postingFor(slug)
  if (!found) notFound()
  const { posting, organizationName } = found

  return (
    <Stack gap="xl" maw={880} mx="auto">
      {posting.isOpen ? (
        <script
          type="application/ld+json"
          // Serialised data the portal wrote, with "<" escaped so it can never close the tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              jobPostingLd(posting, organizationName, portalUrl(careersPostingRoute(slug))),
            ).replace(/</g, '\\u003c'),
          }}
        />
      ) : null}

      <Stack gap="sm">
        <LinkAnchor href={routes.careers} size="sm" w="fit-content">
          All openings
        </LinkAnchor>
        <Text size="sm" c="dimmed">
          {organizationName}
        </Text>
        <Title order={1}>{posting.title}</Title>
        <PostingMeta {...posting} />
        {posting.closesAt && posting.isOpen ? (
          <Text size="sm" c="dimmed">
            Applications close {dateOnly.format(new Date(posting.closesAt))}
          </Text>
        ) : null}
      </Stack>

      <PostingDescription html={posting.description} />

      <Divider />

      {posting.isOpen ? (
        <Stack gap="md" component="section" aria-labelledby="apply-heading">
          <Title order={2} size="h3" id="apply-heading">
            Apply for this role
          </Title>
          <ApplicationForm posting={posting} organizationName={organizationName} />
        </Stack>
      ) : (
        <Alert color="gray" variant="light" title="This role is no longer taking applications">
          <Text size="sm">
            It has closed.{' '}
            <LinkAnchor href={routes.careers}>See the roles that are open</LinkAnchor>.
          </Text>
        </Alert>
      )}
    </Stack>
  )
}
