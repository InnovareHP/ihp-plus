'use client'

import { Alert, Button, Card, Group, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconWorldCheck } from '@tabler/icons-react'
import { LinkButton } from '@/components/link-button'
import { useNow } from '@/features/attendance/hooks/use-now'
import { useTimeClock } from '@/features/attendance/hooks/use-time-clock'
import { routes } from '@/lib/routes'
import { useChecklist, useRunRound } from '../hooks/use-checklist'
import { CHECK_ROUND_LABELS, CHECK_ROUNDS } from '../schema'
import { awaitingAutoRound, roundForPunch } from '../utils/rounds'
import { describeReading } from '../utils/verdict'
import { CheckStatusBadge } from './check-status-badge'
import { RoundSummary } from './round-summary'

// Often enough that the results appear while the lead is still looking at the clock.
const POLL_MS = 5000

/** The IT lead's website round, beside the clock that starts it. */
export function TimeClockChecks() {
  const clock = useTimeClock()
  const day = clock.data?.today
  const round = roundForPunch(day)
  const punchedAt = day?.isOpen ? day.clockInAt : day?.clockOutAt

  const checklist = useChecklist('', (list) =>
    list && awaitingAutoRound(list.websites, round, punchedAt, Date.now()) ? POLL_MS : false,
  )
  const run = useRunRound('')
  const list = checklist.data
  // Ticks so the "checking now" line goes away once the punch is too old to still be landing.
  const now = useNow(Boolean(punchedAt), POLL_MS)
  const waiting = Boolean(list && awaitingAutoRound(list.websites, round, punchedAt, now))
  const problems = round
    ? (list?.websites ?? []).flatMap((site) => {
        const check = site.checks[round]
        return check && check.status !== 'up' ? [{ site, check }] : []
      })
    : []

  return (
    <Card padding="lg" component="section" aria-labelledby="time-clock-checks-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2} miw={0}>
            <Title order={2} size="h5" id="time-clock-checks-heading">
              Website checks
            </Title>
            <Text size="sm" c="dimmed" maw="60ch">
              Clocking in runs the time-in check on every client website, and clocking out runs the
              time-out check.
            </Text>
          </Stack>
          <LinkButton href={routes.websites} variant="default">
            Open website checks
          </LinkButton>
        </Group>

        {checklist.isPending ? (
          <Stack gap="xs" aria-busy="true" aria-label="Loading website checks">
            <Skeleton height={20} width="18rem" />
            <Skeleton height={20} width="18rem" />
          </Stack>
        ) : checklist.isError || !list ? (
          <Alert role="alert" color="red" variant="light" title="Could not load website checks">
            <Stack gap="xs" align="flex-start">
              <Text size="sm">Check your connection and try again.</Text>
              <Button size="xs" variant="default" onClick={() => checklist.refetch()}>
                Try again
              </Button>
            </Stack>
          </Alert>
        ) : list.websites.length === 0 ? (
          <Text size="sm" c="dimmed">
            No client websites on the list yet. Add them on the website checks page and they are
            checked every time you clock in and out.
          </Text>
        ) : (
          <Stack gap="sm">
            {CHECK_ROUNDS.map((each) => (
              <RoundSummary key={each} round={each} websites={list.websites} />
            ))}

            {waiting ? (
              <Text size="sm" role="status">
                Checking every site now — results appear here as they come in.
              </Text>
            ) : null}

            {problems.length > 0 ? (
              <Stack gap="xs" component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
                {problems.map(({ site, check }) => (
                  <Group component="li" key={site.id} gap="xs" wrap="wrap">
                    <CheckStatusBadge status={check.status} />
                    <Text size="sm" fw={600}>
                      {site.name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {describeReading(check)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            ) : null}

            {round ? (
              <Group>
                <Button
                  variant="light"
                  leftSection={<IconWorldCheck size={18} aria-hidden />}
                  loading={run.isPending}
                  onClick={() => run.mutate({ round })}
                >
                  {`Run ${CHECK_ROUND_LABELS[round].toLowerCase()} check again`}
                </Button>
              </Group>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
