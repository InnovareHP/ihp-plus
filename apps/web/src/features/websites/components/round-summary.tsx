import { Group, Text } from '@mantine/core'
import { CHECK_ROUND_LABELS, type CheckRound, type WebsiteRow } from '../schema'
import { roundCounts } from '../utils/rounds'

export interface RoundSummaryProps {
  round: CheckRound
  websites: readonly WebsiteRow[]
}

/** One line per round, so a glance says whether it was done and what it found. */
export function RoundSummary({ round, websites }: RoundSummaryProps) {
  const counts = roundCounts(websites, round)
  const done = counts.unchecked === 0
  return (
    <Group gap="xs" wrap="wrap">
      <Text size="sm" fw={600}>
        {CHECK_ROUND_LABELS[round]}:
      </Text>
      <Text size="sm" c="dimmed">
        {done
          ? `${counts.up} running, ${counts.issue} with issues, ${counts.down} down`
          : `${counts.unchecked} of ${websites.length} not checked yet`}
      </Text>
    </Group>
  )
}
