import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'

export const metadata: Metadata = { title: 'Set a new password' }

export default function ResetPasswordPage() {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h3">
          Set a new password
        </Title>
        <Text size="sm" c="dimmed">
          Choose a password of at least 12 characters.
        </Text>
      </Stack>
      {/* The reset token arrives in the query string, which needs a Suspense boundary. */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </Stack>
  )
}
