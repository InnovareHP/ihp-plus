// A sub-component reached as Timeline.Item resolves to undefined in the browser chunk when a
// server component renders it, so the named export is imported directly.
import { Text, Timeline, TimelineItem } from '@mantine/core'

export interface ActivityTimelineItem {
  id: string
  label: string
  actorName: string
  detail: string | undefined
  createdAt: string
}

export interface ActivityTimelineProps {
  items: readonly ActivityTimelineItem[]
  /** Accessible name for the list, e.g. "Contract history". */
  label: string
}

const stamp = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function ActivityTimeline({ items, label }: ActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No history recorded yet. Changes made from now on appear here.
      </Text>
    )
  }

  return (
    // Mantine draws the timeline in divs, so the list semantics are given back explicitly.
    <Timeline
      active={items.length - 1}
      bulletSize={12}
      lineWidth={2}
      role="list"
      aria-label={label}
    >
      {items.map((item) => (
        <TimelineItem key={item.id} title={item.label} role="listitem">
          <Text size="xs" c="dimmed">
            {item.actorName} ·{' '}
            <time dateTime={item.createdAt}>{stamp.format(new Date(item.createdAt))}</time>
          </Text>
          {item.detail ? (
            <Text size="sm" mt={4}>
              {item.detail}
            </Text>
          ) : null}
        </TimelineItem>
      ))}
    </Timeline>
  )
}
