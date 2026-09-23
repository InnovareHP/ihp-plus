'use client'

import { Button, Group, List, Modal, Stack, Text, Title } from '@mantine/core'
import { formatHours } from '@ihp/clock'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import type { TeamCalendarDayRow, TeamCalendarEntry, TeamCalendarState } from '../schema'

export interface TeamDayModalProps {
  day: TeamCalendarDayRow | undefined
  onClose: () => void
}

const heading = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const GROUPS: { label: string; states: readonly TeamCalendarState[] }[] = [
  { label: 'In', states: ['worked', 'open'] },
  { label: 'Absent', states: ['absent'] },
  { label: 'On leave', states: ['leave'] },
  { label: 'Off for a holiday', states: ['holiday'] },
]

function detailOf(entry: TeamCalendarEntry) {
  if (entry.state === 'open') return 'still clocked in'
  if (entry.state === 'worked') return formatHours(entry.workedSeconds)
  if (entry.state === 'leave') return entry.leaveName
  return undefined
}

/** Who was in, absent and on leave on one day, with the board one click away to correct it. */
export function TeamDayModal({ day, onClose }: TeamDayModalProps) {
  return (
    <Modal
      opened={day !== undefined}
      onClose={onClose}
      title={day ? heading.format(new Date(`${day.date}T00:00:00Z`)) : ''}
      closeButtonProps={{ 'aria-label': 'Close the day' }}
      centered
    >
      {day ? (
        <Stack gap="md">
          {GROUPS.map((group) => {
            const people = day.people.filter((one) => group.states.includes(one.state))
            if (people.length === 0) return null
            return (
              <Stack key={group.label} gap={4}>
                <Title order={3} size="h6">
                  {group.label} ({people.length})
                </Title>
                <List size="sm" spacing={2}>
                  {people.map((one) => {
                    const detail = detailOf(one)
                    return (
                      <List.Item key={one.userId}>
                        {one.userName}
                        {detail ? (
                          <Text span size="sm" c="dimmed">
                            {' '}
                            · {detail}
                          </Text>
                        ) : null}
                      </List.Item>
                    )
                  })}
                </List>
              </Stack>
            )
          })}
          <Group justify="flex-end">
            <Button
              component={Link}
              href={`${routes.attendanceTeam}?to=${day.date}`}
              variant="light"
            >
              Open this day on the board
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  )
}
