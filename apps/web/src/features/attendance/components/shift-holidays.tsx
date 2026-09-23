'use client'

import { Badge, Button, Group, Select, Stack, Text } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { offerUndo } from '@/lib/undo'
import {
  useAddHoliday,
  useDeleteHoliday,
  useHolidays,
  useImportHolidays,
} from '../hooks/use-holidays'
import { attendanceKeys } from '../query-keys'
import type { AttendanceHolidayRow, HolidayCountryOption } from '../schema'
import { holidayAppliesTo } from '../utils/holidays'
import { AddHolidayForm } from './add-holiday-form'

// UTC because the key is a calendar date, and any other zone could print the day before.
const dateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export interface ShiftHolidaysProps {
  /** The country the saved shift follows; empty when it follows none. */
  country: string
  countries: readonly HolidayCountryOption[]
}

/** The days off a shift gets: its country's public holidays and every company-wide day. */
export function ShiftHolidays({ country, countries }: ShiftHolidaysProps) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const holidays = useHolidays(year)
  const add = useAddHoliday(year)
  const remove = useDeleteHoliday(year)
  const fill = useImportHolidays()
  const queryClient = useQueryClient()

  const countryName = countries.find((one) => one.code === country)?.name ?? country
  const rows = holidays.data?.filter((row) => holidayAppliesTo(row.country, country))

  function drop(row: AttendanceHolidayRow) {
    // Undo over confirm: the row goes at once, and the server is only told when the toast closes.
    const key = attendanceKeys.holidays(year)
    const previous = queryClient.getQueryData<AttendanceHolidayRow[]>(key)
    queryClient.setQueryData<AttendanceHolidayRow[]>(key, (all) =>
      all?.filter((one) => one.id !== row.id),
    )

    offerUndo({
      message: `Removed ${row.name}`,
      undoLabel: 'Undo',
      onUndo: () => queryClient.setQueryData(key, previous),
      onCommit: () => remove.mutate({ holidayId: row.id }),
    })
  }

  const columns: DataTableColumn<AttendanceHolidayRow>[] = [
    {
      key: 'date',
      header: 'Date',
      width: 120,
      render: (row) => dateFormat.format(new Date(`${row.date}T00:00:00Z`)),
    },
    {
      key: 'name',
      header: 'Day off',
      rowHeader: true,
      render: (row) => (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          {row.country ? null : (
            <Badge size="xs" variant="light" color="gray">
              Everyone
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 100,
      render: (row) => (
        <Button
          variant="subtle"
          color="red"
          size="compact-sm"
          // A pending row has no server id to delete yet.
          disabled={row.id.startsWith('pending-')}
          onClick={() => drop(row)}
          aria-label={`Remove ${row.name}`}
        >
          Remove
        </Button>
      ),
    },
  ]

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Select
          label="Year"
          w={110}
          allowDeselect={false}
          value={String(year)}
          data={[thisYear - 1, thisYear, thisYear + 1].map(String)}
          onChange={(value) => setYear(Number(value ?? thisYear))}
        />
        {country ? (
          <Button
            variant="light"
            loading={fill.isPending}
            onClick={() => fill.mutate({ year, country })}
          >
            {fill.isPending ? 'Filling in…' : `Fill in ${countryName} ${year}`}
          </Button>
        ) : null}
      </Group>

      <DataTable
        label={`Days off in ${year}`}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isPending={holidays.isPending}
        isError={holidays.isError}
        isFetching={holidays.isFetching}
        onRetry={() => void holidays.refetch()}
        errorTitle="Could not load the days off"
        minWidth={380}
        empty={
          <Text size="sm" c="dimmed">
            {country
              ? `No days off in ${year} yet — fill in ${countryName}'s public holidays above.`
              : `No company-wide days off in ${year}. Add the days the company is closed below.`}
          </Text>
        }
      />

      <AddHolidayForm
        year={year}
        countries={countries.filter((one) => one.code === country)}
        defaultCountry={country}
        onAdd={(values) => add.mutateAsync(values)}
      />
    </Stack>
  )
}
