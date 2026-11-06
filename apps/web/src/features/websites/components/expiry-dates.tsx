import { Group, Skeleton, Stack, Text } from '@mantine/core'
import { formatDate } from '../utils/day-report'
import { daysUntil, EXPIRY_WARNING_DAYS } from '../utils/domain'

export interface ExpiryDatesProps {
  domain: string | undefined
  ssl: string | undefined
  isPending: boolean
  timeZone: string
  now: Date
}

function ExpiryLine({
  label,
  at,
  timeZone,
  now,
}: {
  label: string
  at: string | undefined
  timeZone: string
  now: Date
}) {
  if (!at) {
    return (
      <Text size="sm">
        {label}:{' '}
        <Text span c="dimmed" inherit>
          Not available
        </Text>
      </Text>
    )
  }
  const days = daysUntil(at, now)
  const soon = days <= EXPIRY_WARNING_DAYS
  return (
    <Text size="sm">
      {label}:{' '}
      <Text span fw={soon ? 700 : 400} c={soon ? 'red' : undefined} inherit>
        {formatDate(at, timeZone)} ·{' '}
        {days < 0 ? 'expired' : days === 0 ? 'expires today' : `${days} days left`}
      </Text>
    </Text>
  )
}

export function ExpiryDates({ domain, ssl, isPending, timeZone, now }: ExpiryDatesProps) {
  if (isPending) {
    return (
      <Stack gap={6} aria-busy="true" aria-label="Looking up domain and certificate dates">
        <Skeleton height={20} width="70%" />
        <Skeleton height={20} width="60%" />
      </Stack>
    )
  }
  return (
    <Group gap="lg" wrap="wrap">
      <ExpiryLine label="Domain expires" at={domain} timeZone={timeZone} now={now} />
      <ExpiryLine label="SSL certificate expires" at={ssl} timeZone={timeZone} now={now} />
    </Group>
  )
}
