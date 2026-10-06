'use client'

import { Group, Select } from '@mantine/core'
import { searchParamsParser, useUrlQuery } from '@/lib/url-query'
import {
  DEFAULT_REPORT_QUERY,
  REPORT_PERIOD_LABELS,
  REPORT_PERIODS,
  reportQuerySchema,
} from '../schema'

const parseReportQuery = searchParamsParser(reportQuerySchema)

const PERIOD_OPTIONS = REPORT_PERIODS.map((period) => ({
  value: period,
  label: REPORT_PERIOD_LABELS[period],
}))

export interface ReportFiltersProps {
  postingOptions: { value: string; label: string }[]
}

export function ReportFilters({ postingOptions }: ReportFiltersProps) {
  const { query, setQuery } = useUrlQuery(parseReportQuery, DEFAULT_REPORT_QUERY)

  return (
    <Group gap="md" align="flex-end" wrap="wrap">
      <Select
        label="Applied in"
        data={PERIOD_OPTIONS}
        value={query.period}
        onChange={(value) =>
          setQuery({ period: REPORT_PERIODS.find((period) => period === value) ?? 'all' })
        }
        allowDeselect={false}
        w={200}
      />
      <Select
        label="Posting"
        data={postingOptions}
        value={query.postingId || null}
        onChange={(value) => setQuery({ postingId: value ?? '' })}
        placeholder="All postings"
        clearable
        searchable={postingOptions.length > 8}
        w={{ base: '100%', xs: 320 }}
      />
    </Group>
  )
}
