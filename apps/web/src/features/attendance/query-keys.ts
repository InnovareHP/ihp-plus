import type { AttendanceRange } from './rpc'

export const attendanceKeys = {
  all: ['attendance'] as const,
  settings: () => [...attendanceKeys.all, 'settings'] as const,
  clock: () => [...attendanceKeys.all, 'clock'] as const,
  log: (range: AttendanceRange) => [...attendanceKeys.all, 'log', range] as const,
  logs: () => [...attendanceKeys.all, 'log'] as const,
  board: (date: string) => [...attendanceKeys.all, 'board', date] as const,
  schedules: () => [...attendanceKeys.all, 'schedules'] as const,
  shifts: () => [...attendanceKeys.all, 'shifts'] as const,
  calendar: (month: string, userId = '') =>
    [...attendanceKeys.all, 'calendar', month, userId] as const,
  teamCalendar: (month: string) => [...attendanceKeys.all, 'team-calendar', month] as const,
  holidays: (year: number) => [...attendanceKeys.all, 'holidays', year] as const,
  holidayCountries: () => [...attendanceKeys.all, 'holiday-countries'] as const,
}
