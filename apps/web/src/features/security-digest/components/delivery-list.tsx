import { Badge, Group, Stack, Text } from '@mantine/core'
import type { DeliveryRow, DeliveryStatus } from '../schema'

const LABELS: Record<DeliveryStatus, string> = {
  sent: 'Delivered',
  failed: 'Failed',
  not_configured: 'Logged only',
}

const COLORS: Record<DeliveryStatus, string> = {
  sent: 'teal',
  failed: 'red',
  not_configured: 'gray',
}

/** Each recipient of one issue and whether the mail server took it. */
export function DeliveryList({ deliveries }: { deliveries: readonly DeliveryRow[] }) {
  if (deliveries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nobody has been sent this issue yet.
      </Text>
    )
  }
  return (
    <Stack component="ul" gap={6} p={0} m={0} style={{ listStyle: 'none' }} aria-label="Deliveries">
      {deliveries.map((delivery) => (
        <Group component="li" key={delivery.id} justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm" truncate>
            {delivery.email}
          </Text>
          <Badge color={COLORS[delivery.status]} variant="light">
            {LABELS[delivery.status]}
          </Badge>
        </Group>
      ))}
    </Stack>
  )
}
