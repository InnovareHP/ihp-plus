'use client'

import { Group, Select } from '@mantine/core'
import type { DayRange } from '../days'
import type { RangePreset } from '../report-range'
import { REPORT_SITES } from '../sites'
import { DateRangePicker } from './date-range-picker'

const SITE_OPTIONS = [
  {
    group: 'Google Analytics',
    items: REPORT_SITES.filter((site) => site.source === 'ga4').map((site) => ({
      value: site.key,
      label: site.name,
    })),
  },
  {
    group: 'Netlify',
    items: REPORT_SITES.filter((site) => site.source === 'netlify').map((site) => ({
      value: site.key,
      label: site.name,
    })),
  },
]

export interface AnalyticsControlsProps {
  siteKey: string
  preset: RangePreset
  range: DayRange
  today: string
  onSiteChange: (siteKey: string) => void
  onRangeChange: (preset: RangePreset, range: DayRange) => void
}

export function AnalyticsControls({
  siteKey,
  preset,
  range,
  today,
  onSiteChange,
  onRangeChange,
}: AnalyticsControlsProps) {
  return (
    <Group align="flex-end" gap="md" wrap="wrap">
      <Select
        label="Website"
        data={SITE_OPTIONS}
        value={siteKey}
        onChange={(value) => {
          if (value) onSiteChange(value)
        }}
        allowDeselect={false}
        w={{ base: '100%', sm: 260 }}
      />
      <DateRangePicker preset={preset} range={range} today={today} onApply={onRangeChange} />
    </Group>
  )
}
