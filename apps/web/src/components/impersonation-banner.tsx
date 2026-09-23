'use client'

import { Alert, Button, Group, Text } from '@mantine/core'
import { IconUserShield } from '@tabler/icons-react'

export interface ImpersonationBannerProps {
  name: string
  isPending: boolean
  onReturn: () => void
}

export function ImpersonationBanner({ name, isPending, onReturn }: ImpersonationBannerProps) {
  return (
    <Alert
      role="status"
      color="yellow"
      radius={0}
      icon={<IconUserShield size={20} aria-hidden />}
      title={`You are signed in as ${name}`}
    >
      <Group justify="space-between" gap="sm">
        <Text size="sm">
          Everything you do here is done as them. Return to your own account when you are finished.
        </Text>
        <Button
          size="compact-sm"
          variant="white"
          color="dark"
          loading={isPending}
          onClick={onReturn}
        >
          Return to your account
        </Button>
      </Group>
    </Alert>
  )
}
