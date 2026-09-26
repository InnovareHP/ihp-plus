import { Group, Stack, Text } from '@mantine/core'

export interface StatementIdentityProps {
  name: string
  position: string
  fixedPay: boolean
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed" component="dt">
        {label}
      </Text>
      <Text size="sm" fw={500} component="dd" m={0}>
        {value}
      </Text>
    </Stack>
  )
}

/** Who is billing and on what basis, read from the profile so nobody bills under another name. */
export function StatementIdentity({ name, position, fixedPay }: StatementIdentityProps) {
  return (
    <Stack gap="xs">
      <Group component="dl" gap="xl" m={0} align="flex-start">
        <Detail label="Full name" value={name} />
        <Detail label="Position / role" value={position || 'Not on your profile yet'} />
        <Detail label="Pay" value={fixedPay ? 'Fixed pay' : 'Daily rate'} />
      </Group>
      <Text size="xs" c="dimmed">
        From your profile. If any of this is wrong, ask an admin to update it in Members.
      </Text>
    </Stack>
  )
}
