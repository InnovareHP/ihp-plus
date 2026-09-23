'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticListMutation } from '@/lib/optimistic'
import { attendanceEvents } from '../events'
import { attendanceKeys } from '../query-keys'
import { deleteHoliday, listHolidays, saveHoliday } from '../rpc'
import type { AttendanceHolidayRow, HolidayValues } from '../schema'

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
        { id: `pending-${crypto.randomUUID()}`, date: values.date, name: values.name },
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
