'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { track } from '@/lib/analytics'
import { announceFailure, announceSuccess } from '@/lib/announce'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import {
  deleteHoliday,
  importHolidays,
  listHolidayCountries,
  listHolidays,
  saveHoliday,
} from '../rpc'
import type { AttendanceHolidayRow, HolidayValues, ImportHolidaysValues } from '../schema'

export function useHolidays(year: number) {
  return useQuery({
    queryKey: attendanceKeys.holidays(year),
    queryFn: async () => (await listHolidays(year)).holidays,
    staleTime: 5 * 60 * 1000,
  })
}

function byDate(rows: AttendanceHolidayRow[]) {
  return rows.sort((left, right) => left.date.localeCompare(right.date))
}

export function useAddHoliday(year: number) {
  return useOptimisticListMutation<AttendanceHolidayRow, HolidayValues>({
    queryKey: attendanceKeys.holidays(year),
    mutationFn: async (values) => {
      await saveHoliday(values)
    },
    // The server's id arrives with the refetch, so the pending row carries a temporary one.
    apply: (rows, values) =>
      byDate([
        ...rows,
        {
          id: `pending-${crypto.randomUUID()}`,
          date: values.date,
          name: values.name,
          country: values.country,
          imported: false,
        },
      ]),
    successEvent: attendanceEvents.holidayAdded,
    failureEvent: attendanceEvents.holidayAddFailed,
    // Today's clock and the timesheets both read the calendar.
    alsoInvalidate: [attendanceKeys.clock(), attendanceKeys.logs()],
  })
}

export function useDeleteHoliday(year: number) {
  return useOptimisticListMutation<AttendanceHolidayRow, { holidayId: string }>({
    queryKey: attendanceKeys.holidays(year),
    mutationFn: ({ holidayId }) => deleteHoliday(holidayId),
    apply: (rows, { holidayId }) => rows.filter((row) => row.id !== holidayId),
    successEvent: attendanceEvents.holidayDeleted,
    failureEvent: attendanceEvents.holidayDeleteFailed,
    alsoInvalidate: [attendanceKeys.clock(), attendanceKeys.logs()],
  })
}

export function useHolidayCountries() {
  return useQuery({
    queryKey: attendanceKeys.holidayCountries(),
    queryFn: listHolidayCountries,
    // The list ships inside the server's holiday package and only changes with a deploy.
    staleTime: Infinity,
  })
}

// Not optimistic: which days a country has off is the calendar's answer, not the client's.
export function useImportHolidays() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: ImportHolidaysValues) => importHolidays(values),
    onSuccess: (added, values) => {
      track(attendanceEvents.holidaysImported, {
        country: values.country,
        year: values.year,
        added: added.length,
      })
      announceSuccess(
        added.length === 0
          ? `Every ${values.year} public holiday is already on the calendar.`
          : `Added ${added.length} public holiday${added.length === 1 ? '' : 's'} for ${values.year}.`,
      )
    },
    onError: (error, values) => {
      track(attendanceEvents.holidaysImportFailed, {
        country: values.country,
        reason: error.message,
      })
      announceFailure(error.message)
    },
    onSettled: (_data, _error, values) => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.holidays(values.year) })
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.clock() })
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.logs() })
    },
  })
}
