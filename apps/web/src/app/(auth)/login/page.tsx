import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/features/auth/components/login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h3">
          Sign in
        </Title>
        <Text size="sm" c="dimmed">
          Use your email and password, or your Outlook account.
        </Text>
      </Stack>
      {/* useSearchParams needs a boundary so the shell is not held back by the query string. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </Stack>
  )
}
