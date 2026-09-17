import { List, Text } from '@mantine/core'
import type { ChartPerson } from '../schema'

export interface ChartPeopleProps {
  people: readonly ChartPerson[]
  /** Leads read heavier than the people who report to them. */
  emphasis?: boolean
  emptyText: string
}

export function ChartPeople({ people, emphasis = false, emptyText }: ChartPeopleProps) {
  if (people.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {emptyText}
      </Text>
    )
  }

  return (
    <List listStyleType="none" spacing={4} ml={0} pl={0}>
      {people.map((person) => (
        <List.Item key={person.userId}>
          <Text size="sm" fw={emphasis ? 600 : 400}>
            {person.name}
          </Text>
          {person.jobTitle ? (
            <Text size="xs" c="dimmed">
              {person.jobTitle}
            </Text>
          ) : null}
        </List.Item>
      ))}
    </List>
  )
}
