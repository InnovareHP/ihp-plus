'use client'

import { LineChart } from '@mantine/charts'
import { Stack, Text } from '@mantine/core'
import { formatCount, formatShortDay } from '../format'

export interface SessionsChartProps {
  days: { day: string; sessions: number; previousSessions: number }[]
  total: number
  previousTotal: number
}

export function SessionsChart({ days, total, previousTotal }: SessionsChartProps) {
  const data = days.map((one) => ({
    label: formatShortDay(one.day),
    sessions: one.sessions,
    previousSessions: one.previousSessions,
  }))

  return (
    <Stack gap="xs" component="figure" m={0}>
      <Text component="figcaption" fw={600}>
        Sessions per day
      </Text>
      {/* The chart is drawn, so its totals are spoken instead of read off the lines. */}
      <div
        role="img"
        aria-label={`Sessions per day: ${formatCount(total)} this period against ${formatCount(previousTotal)} the period before.`}
      >
        <LineChart
          h={260}
          data={data}
          dataKey="label"
          series={[
            {
              name: 'sessions',
              label: 'This period',
              color: 'var(--mantine-primary-color-filled)',
            },
            {
              name: 'previousSessions',
              label: 'Previous period',
              color: 'gray.6',
              strokeDasharray: '5 5',
            },
          ]}
          curveType="linear"
          strokeWidth={2}
          withDots={false}
          withLegend
          legendProps={{ verticalAlign: 'top', height: 36 }}
          gridAxis="y"
          tickLine="none"
          valueFormatter={formatCount}
          xAxisProps={{ minTickGap: 24 }}
          yAxisProps={{ allowDecimals: false, width: 40 }}
        />
      </div>
    </Stack>
  )
}
