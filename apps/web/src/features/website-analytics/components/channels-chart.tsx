'use client'

import { BarChart } from '@mantine/charts'
import { Stack, Text } from '@mantine/core'
import { formatCount } from '../format'

export interface ChannelsChartProps {
  channels: { channel: string; sessions: number }[]
}

const ROW_HEIGHT = 36

export function ChannelsChart({ channels }: ChannelsChartProps) {
  const spoken = channels.map((one) => `${one.channel} ${formatCount(one.sessions)}`).join(', ')

  return (
    <Stack gap="xs" component="figure" m={0}>
      <Text component="figcaption" fw={600}>
        Sessions by channel
      </Text>
      {channels.length === 0 ? (
        <Text size="sm">No sessions in this range.</Text>
      ) : (
        <div role="img" aria-label={`Sessions by channel: ${spoken}.`}>
          <BarChart
            h={channels.length * ROW_HEIGHT + 32}
            data={channels}
            dataKey="channel"
            orientation="vertical"
            series={[
              {
                name: 'sessions',
                label: 'Sessions',
                color: 'var(--mantine-primary-color-filled)',
              },
            ]}
            withBarValueLabel
            valueFormatter={formatCount}
            gridAxis="none"
            tickLine="none"
            withXAxis={false}
            yAxisProps={{ width: 120 }}
            maxBarWidth={20}
            barProps={{ radius: [0, 4, 4, 0] }}
          />
        </div>
      )}
    </Stack>
  )
}
