import { z } from 'zod'
import { clockToMinutes, DEFAULT_WORKDAYS, parseWorkdays } from './utils/clock'

export type AttendanceStatus = 'open' | 'recorded' | 'approved'

export type AttendanceSource = 'clock' | 'manual'

/** What the board says about a person right now. */
export type AttendanceState = 'in' | 'break' | 'out' | 'absent'

export interface AttendanceBreakRow {
  id: string
  startedAt: string
  endedAt: string | undefined
  seconds: number
  isRunning: boolean
}

export interface AttendanceDayRow {
  id: string
  userId: string
  userName: string
  workDate: string
  clockInAt: string
  clockOutAt: string | undefined
  workedSeconds: number
  breakSeconds: number
  lateSeconds: number
  status: AttendanceStatus
  source: AttendanceSource
  note: string | undefined
  clockInSelfieUrl: string | undefined
  clockOutSelfieUrl: string | undefined
  clockInLocation: string | undefined
  clockOutLocation: string | undefined
  isOpen: boolean
  onBreak: boolean
  breaks: AttendanceBreakRow[]
  approvedByName: string | undefined
}

export interface AttendanceShiftRow {
  id: string
  name: string
  shiftStartMinutes: number
  shiftEndMinutes: number
  graceMinutes: number
  workdays: string
  assignedCount: number
}

export interface AttendanceScheduleRow {
  userId: string
  userName: string
  shiftStartMinutes: number
  shiftEndMinutes: number
  graceMinutes: number
  workdays: string
  isDefault: boolean
  shiftId: string | undefined
  shiftName: string | undefined
  jobTitle: string | undefined
}

export interface AttendanceBoardRow {
  userId: string
  userName: string
  jobTitle: string | undefined
  day: AttendanceDayRow | undefined
  state: AttendanceState
}

export interface AttendanceBoard {
  rows: AttendanceBoardRow[]
  date: string
  presentCount: number
  lateCount: number
  absentCount: number
}

export interface AttendanceLog {
  days: AttendanceDayRow[]
  totalWorkedSeconds: number
  totalBreakSeconds: number
  totalLateSeconds: number
}

export interface TimeClockView {
  today: AttendanceDayRow | undefined
  settings: AttendanceSettingsRow
  schedule: AttendanceScheduleRow
  canManage: boolean
}

export interface AttendanceSettingsView {
  settings: AttendanceSettingsRow
  canManage: boolean
}

const workdaysField = z
  .string()
  .refine((value) => parseWorkdays(value).length > 0, 'Pick at least one working day.')

export const attendanceSettingsSchema = z
  .object({
    requireSelfie: z.boolean(),
    requireNote: z.boolean(),
    captureLocation: z.boolean(),
    autoClockOutHours: z
      .number()
      .int()
      .min(0, 'Use 0 to never close a day on its own.')
      .max(24, 'A day is the longest a clock may run.'),
    shiftStartMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1),
    shiftEndMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1),
    graceMinutes: z
      .number()
      .int()
      .min(0, 'Grace cannot be negative.')
      .max(120, 'Two hours is the most grace allowed.'),
    workdays: workdaysField,
    timeZone: z.string().min(1, 'Pick the zone the working day is counted in.'),
  })
  .refine((values) => values.shiftStartMinutes !== values.shiftEndMinutes, {
    message: 'A shift cannot start and end at the same minute.',
    path: ['shiftEndMinutes'],
  })

export type AttendanceSettingsRow = z.infer<typeof attendanceSettingsSchema>

/** The rules an organization has before anybody opens the screen, and the form's first render. */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsRow = {
  requireSelfie: false,
  requireNote: false,
  captureLocation: false,
  autoClockOutHours: 16,
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: DEFAULT_WORKDAYS,
  timeZone: 'UTC',
}

export const shiftSchema = z
  .object({
    shiftId: z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Give the shift a name people will recognise.')
      .max(60, 'Keep the name under 60 characters.'),
    shiftStartMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1),
    shiftEndMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 - 1),
    graceMinutes: z.number().int().min(0, 'Grace cannot be negative.').max(120),
    workdays: workdaysField,
  })
  .refine((values) => values.shiftStartMinutes !== values.shiftEndMinutes, {
    message: 'A shift cannot start and end at the same minute.',
    path: ['shiftEndMinutes'],
  })

export type ShiftValues = z.infer<typeof shiftSchema>

export const assignShiftSchema = z.object({
  userId: z.string().min(1, 'Pick who the shift is for.'),
  /** Empty puts the person back on the company hours. */
  shiftId: z.string(),
})

export type AssignShiftValues = z.infer<typeof assignShiftSchema>

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-22.')

const timeOfDay = z.string().regex(/^\d{1,2}:\d{2}$/, 'Use a time like 09:00.')

/**
 * The form types times of day, not instants: an admin correcting yesterday thinks in "09:00",
 * and the service pins that to the work date in the organization's zone.
 */
export const attendanceDaySchema = z
  .object({
    dayId: z.string().optional(),
    userId: z.string().min(1, 'Pick whose day this is.'),
    workDate: dateKey,
    clockInTime: timeOfDay,
    clockOutTime: z.union([timeOfDay, z.literal('')]),
    breakMinutes: z
      .number()
      .int()
      .min(0, 'Break time cannot be negative.')
      .max(12 * 60, 'A break cannot run longer than half a day.'),
    note: z.string().trim().max(200, 'Keep the note under 200 characters.'),
  })
  .refine(
    (values) => {
      const start = clockToMinutes(values.clockInTime)
      const end = values.clockOutTime ? clockToMinutes(values.clockOutTime) : undefined
      return start !== undefined && (end === undefined || end !== start)
    },
    { message: 'A day cannot start and end at the same minute.', path: ['clockOutTime'] },
  )

export type AttendanceDayValues = z.infer<typeof attendanceDaySchema>

export const clockActionSchema = z.object({
  selfieKey: z.string().trim().default(''),
  location: z.string().trim().max(120).default(''),
  note: z.string().trim().max(200, 'Keep the note under 200 characters.').default(''),
})

export type ClockActionValues = z.infer<typeof clockActionSchema>

export const MAX_SELFIE_BYTES = 5 * 1024 * 1024

// The camera hands back a JPEG; a picked file, the way in when the camera will not open, may be
// any of these.
export const SELFIE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function extensionFor(contentType: string): string {
  return SELFIE_TYPES[contentType] ?? 'jpg'
}

export function selfieProblem(file: File): string | undefined {
  if (!(file.type in SELFIE_TYPES)) return 'A selfie must be a JPEG, PNG or WebP photo.'
  if (file.size > MAX_SELFIE_BYTES) return 'That photo is too large — take or pick a smaller one.'
  return undefined
}
