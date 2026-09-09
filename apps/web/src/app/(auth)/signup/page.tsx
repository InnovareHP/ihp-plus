import { Stack, Text, Title } from '@mantine/core'
import type { Metadata } from 'next'
import { SignupForm } from '@/features/auth/components/signup-form'

export const metadata: Metadata = { title: 'Create account' }

export default function SignupPage() {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h3">
          Create your account
        </Title>
        <Text size="sm" c="dimmed">
          Sign up with an email and password, or continue with Outlook.
        </Text>
      </Stack>
      <SignupForm />
    </Stack>
  )
}
