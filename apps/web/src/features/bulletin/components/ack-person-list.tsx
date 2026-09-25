import { Avatar, Group, ScrollArea, Stack, Text } from '@mantine/core'
import type { AcknowledgementPersonRow } from '../schema'

export interface AckPersonListProps {
  people: readonly AcknowledgementPersonRow[]
  empty: string
  detail: (person: AcknowledgementPersonRow) => string | undefined
}

export function AckPersonList({ people, empty, detail }: AckPersonListProps) {
  if (people.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="sm">
        {empty}
      </Text>
    )
  }

  return (
    <ScrollArea.Autosize mah={360} type="auto">
      <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
        {people.map((person) => (
          <Group component="li" key={person.userId} gap="sm" wrap="nowrap">
            <Avatar size={28} radius="xl" color="initials" name={person.name} />
            <Stack gap={0} miw={0}>
              <Text size="sm" fw={500} truncate>
                {person.name}
              </Text>
              {detail(person) ? (
                <Text size="xs" c="dimmed">
                  {detail(person)}
                </Text>
              ) : null}
            </Stack>
          </Group>
        ))}
      </Stack>
    </ScrollArea.Autosize>
  )
}
