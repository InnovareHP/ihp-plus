'use client'

import { LineChart } from '@mantine/charts'
import { Stack, Text } from '@mantine/core'
import { formatCount, formatShortDay } from '../format'

export interface PeriodChartProps {
  /** What is counted, in sentence case, such as "Sessions". */
  metric: string
  days: { day: string; current: number; previous: number }[]
  total: number
  previousTotal: number
}

/** One count per day for the range, with the period before drawn dashed behind it. */
export function PeriodChart({ metric, days, total, previousTotal }: PeriodChartProps) {
  const data = days.map((one) => ({
    label: formatShortDay(one.day),
    current: one.current,
    previous: one.previous,
  }))

  return (
    <Stack gap="xs" component="figure" m={0}>
      <Text component="figcaption" fw={600}>
        {metric} per day
      </Text>
      {/* The chart is drawn, so its totals are spoken instead of read off the lines. */}
      <div
        role="img"
        aria-label={`${metric} per day: ${formatCount(total)} this period against ${formatCount(previousTotal)} the period before.`}
      >
        <LineChart
          h={260}
          data={data}
          dataKey="label"
          series={[
            {
              name: 'current',
              label: 'This period',
              color: 'var(--mantine-primary-color-filled)',
            },
            {
              name: 'previous',
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
