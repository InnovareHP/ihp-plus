import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'

export const metadata: Metadata = { title: 'Reset your password' }

export default function ForgotPasswordPage() {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h3">
          Reset your password
        </Title>
        <Text size="sm" c="dimmed">
          Enter the address you signed up with and we will email you a reset link.
        </Text>
      </Stack>
      <ForgotPasswordForm />
    </Stack>
  )
}
