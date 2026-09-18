import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { LinkAnchor } from '@/components/link-anchor'
import { ResendVerification } from '@/features/auth/components/resend-verification'
import { routes, safeNextRoute } from '@/lib/routes'

export const metadata: Metadata = { title: 'Confirm your email' }

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>
}) {
  const { email, next } = await searchParams

  if (!email) {
    return (
      <Stack gap="md">
        <Title order={1} size="h3">
          Confirm your email address
        </Title>
        <Text size="sm" c="dimmed">
          Open the link we sent you to finish signing in. Signing in again sends a fresh one.
        </Text>
        <LinkAnchor href={routes.login} size="sm">
          Go to sign in
        </LinkAnchor>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h3">
          Check your inbox
        </Title>
        <Text size="sm" c="dimmed">
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account
          — the link signs you in and brings you back here.
        </Text>
      </Stack>

      <ResendVerification email={email} next={safeNextRoute(next ?? null)} />

      <Text size="sm" c="dimmed">
        Wrong address, or already confirmed?{' '}
        <LinkAnchor href={routes.login} size="sm">
          Go to sign in
        </LinkAnchor>
      </Text>
    </Stack>
  )
}
