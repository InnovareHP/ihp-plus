import { Badge, Group, Text } from '@mantine/core'
import type { AttendanceShiftRow } from '../schema'

/** What a shift's clock asks for, in the words the switches that set it use. */
export function ShiftRules({ shift }: { shift: AttendanceShiftRow }) {
  const asks = [
    shift.requireSelfie ? 'Selfie' : undefined,
    shift.requireNote ? 'Note' : undefined,
    shift.captureLocation ? 'Location' : undefined,
    shift.sendReminders ? 'Reminders' : undefined,
  ].filter((rule): rule is string => Boolean(rule))

  if (asks.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        One tap
      </Text>
    )
  }

  return (
    <Group gap={4} wrap="wrap">
      {asks.map((rule) => (
        <Badge key={rule} variant="light" color="brand">
          {rule}
        </Badge>
      ))}
    </Group>
  )
}
