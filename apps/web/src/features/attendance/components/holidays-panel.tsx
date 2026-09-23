'use client'

import { Badge, Card, Divider, Group, Menu, Select, Stack, Text, Title } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { offerUndo } from '@/lib/undo'
import { useUrlQueryParam } from '@/lib/use-url-query-param'
import {
  useAddHoliday,
  useDeleteHoliday,
  useHolidayCountries,
  useHolidays,
  useImportHolidays,
} from '../hooks/use-holidays'
import { attendanceKeys } from '../query-keys'
import type { AttendanceHolidayRow } from '../schema'
import { AddHolidayForm } from './add-holiday-form'
import { ImportHolidaysForm } from './import-holidays-form'

// UTC because the key is a calendar date, and any other zone could print the day before.
const dateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function yearOf(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallback
}

/** The days nobody is expected in, so the timesheets never count them as absences. */
export function HolidaysPanel() {
  const thisYear = new Date().getFullYear()
  const yearParam = useUrlQueryParam('year', 0)
  const year = yearOf(yearParam.value, thisYear)
  const holidays = useHolidays(year)
  const add = useAddHoliday(year)
  const remove = useDeleteHoliday(year)
  const countries = useHolidayCountries()
  const fill = useImportHolidays()
  const countryName = new Map((countries.data ?? []).map((one) => [one.code, one.name]))
  const suggested = holidays.data?.find((row) => row.country)?.country ?? ''
  const queryClient = useQueryClient()

  function drop(row: AttendanceHolidayRow) {
    // Undo over confirm: the row goes at once, and the server is only told when the toast closes.
    const key = attendanceKeys.holidays(year)
    const previous = queryClient.getQueryData<AttendanceHolidayRow[]>(key)
    queryClient.setQueryData<AttendanceHolidayRow[]>(key, (rows) =>
      rows?.filter((one) => one.id !== row.id),
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
      width: 160,
      render: (row) => dateFormat.format(new Date(`${row.date}T00:00:00Z`)),
    },
    {
      key: 'name',
      header: 'Holiday',
      rowHeader: true,
      render: (row) => (
        <Text size="sm" fw={500}>
          {row.name}
        </Text>
      ),
    },
    {
      key: 'country',
      header: 'Who gets it off',
      render: (row) => (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm">
            {row.country ? (countryName.get(row.country) ?? row.country) : 'Everyone'}
          </Text>
          {row.imported ? (
            <Badge size="xs" variant="light">
              Public calendar
            </Badge>
          ) : null}
        </Group>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 90,
      render: (row) => (
        <RowActionsMenu name={row.name}>
          <Menu.Item
            color="red"
            // A pending row has no server id to delete yet.
            disabled={row.id.startsWith('pending-')}
            onClick={() => drop(row)}
          >
            Remove
          </Menu.Item>
        </RowActionsMenu>
      ),
    },
  ]

  return (
    <Card padding="lg" component="section" aria-labelledby="holidays-heading">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} size="h5" id="holidays-heading">
              Holidays
            </Title>
            <Text size="sm" c="dimmed">
              Days off. Nobody is marked absent on one, and anyone who works it still clocks in as
              usual. A shift that follows a country gets its public holidays filled in each year.
            </Text>
          </Stack>
          <Select
            label="Year"
            w={110}
            allowDeselect={false}
            value={String(year)}
            data={[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(String)}
            onChange={(value) =>
              yearParam.commit(!value || value === String(thisYear) ? '' : value)
            }
          />
        </Group>

        <ImportHolidaysForm
          year={year}
          countries={countries.data ?? []}
          suggested={suggested}
          onImport={(values) => fill.mutateAsync(values)}
        />

        <Divider label="Or add one day" labelPosition="left" />

        <AddHolidayForm
          year={year}
          countries={countries.data ?? []}
          onAdd={(values) => add.mutateAsync(values)}
        />

        <DataTable
          label={`Holidays in ${year}`}
          columns={columns}
          rows={holidays.data}
          rowKey={(row) => row.id}
          isPending={holidays.isPending}
          isError={holidays.isError}
          isFetching={holidays.isFetching}
          onRetry={() => void holidays.refetch()}
          errorTitle="Could not load holidays"
          minWidth={560}
          empty={
            <EmptyState
              title={`No holidays in ${year}`}
              description="Fill in a country's public holidays above, or add the days the company is closed, so nobody reads as absent on them."
            />
          }
        />
      </Stack>
    </Card>
  )
}
