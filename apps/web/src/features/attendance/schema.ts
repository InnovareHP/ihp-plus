import { z } from 'zod'
import { clockToMinutes, COMPANY_HOURS, parseWorkdays } from '@ihp/clock'

export type AttendanceStatus = 'open' | 'recorded'

export type AttendanceSource = 'clock' | 'manual'

/**
 * What the board says about a person on a day. The last four only come from the board: leave and
 * holiday excuse the day, off is outside their shift, and expected is before their start and grace.
 */
export type AttendanceState =
  'in' | 'break' | 'out' | 'absent' | 'leave' | 'holiday' | 'off' | 'expected'

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
  /** Nobody clocked out, so the shift's limit closed it; cleared once an admin corrects it. */
  autoClosed: boolean
}

/** A scheduled day with no clock-in: excused by approved leave, or simply missed. */
export interface AttendanceAbsenceRow {
  userId: string
  userName: string
  workDate: string
  kind: 'absent' | 'leave'
  leaveName: string | undefined
  /** Given by an admin from the timesheet rather than a request, so it can be taken back there. */
  granted: boolean
  /** Leave payroll pays for, so a billing statement counts the day; never true for an absence. */
  paid: boolean
}

export interface AttendanceShiftRow {
  id: string
  name: string
  shiftStartMinutes: number
  shiftEndMinutes: number
  graceMinutes: number
  workdays: string
  assignedCount: number
  requireSelfie: boolean
  requireNote: boolean
  captureLocation: boolean
  autoClockOutHours: number
  isDefault: boolean
  /** Emails a missed clock-in or a forgotten clock-out to whoever works it. */
  sendReminders: boolean
  /** ISO country whose public holidays the shift gets off; empty follows only company-wide days. */
  holidayCountry: string
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
  /** The leave or holiday behind a leave or holiday state. */
  offReason: string | undefined
}

export interface AttendanceBoard {
  rows: AttendanceBoardRow[]
  date: string
  presentCount: number
  lateCount: number
  absentCount: number
  leaveCount: number
}

export interface AttendanceLog {
  days: AttendanceDayRow[]
  totalWorkedSeconds: number
  totalBreakSeconds: number
  totalLateSeconds: number
  absences: AttendanceAbsenceRow[]
}

export interface TimeClockView {
  today: AttendanceDayRow | undefined
  settings: AttendanceSettingsRow
  schedule: AttendanceScheduleRow
  canManage: boolean
  /** The shift this person works, and the rules their clock runs under. */
  shift: AttendanceShiftRow
  /** Today's company holiday, if it is one. */
  holidayName: string | undefined
  /** Today's approved time off, named after the form it came through. */
  leaveName: string | undefined
}

export interface AttendanceSettingsView {
  settings: AttendanceSettingsRow
  canManage: boolean
}

const workdaysField = z
  .string()
  .refine((value) => parseWorkdays(value).length > 0, 'Pick at least one working day.')

/** What is left of company-wide settings once the rules moved onto the shifts they measure. */
export const attendanceSettingsSchema = z.object({
  timeZone: z.string().min(1, 'Pick the zone the working day is counted in.'),
  /** Empty means nobody has named a default, so the built-in hours below apply. */
  defaultShiftId: z.string(),
})

export type AttendanceSettingsRow = z.infer<typeof attendanceSettingsSchema>

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsRow = {
  timeZone: 'UTC',
  defaultShiftId: '',
}

/** The hours and rules a company runs on before anybody writes a shift of its own. */
export const DEFAULT_SHIFT: AttendanceShiftRow = {
  ...COMPANY_HOURS,
  id: '',
  name: 'Company hours',
  assignedCount: 0,
  requireSelfie: false,
  requireNote: false,
  captureLocation: false,
  isDefault: true,
  holidayCountry: '',
}

const shiftFields = z.object({
  shiftId: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Give the shift a name people will recognise.')
    .max(60, 'Keep the name under 60 characters.'),
  requireSelfie: z.boolean(),
  requireNote: z.boolean(),
  captureLocation: z.boolean(),
  sendReminders: z.boolean(),
  holidayCountry: z.string().trim().toUpperCase().max(2),
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
  graceMinutes: z.number().int().min(0, 'Grace cannot be negative.').max(120),
  workdays: workdaysField,
})

const distinctEnds = {
  check: (values: { shiftStartMinutes: number; shiftEndMinutes: number }) =>
    values.shiftStartMinutes !== values.shiftEndMinutes,
  message: 'A shift cannot start and end at the same minute.',
  path: ['shiftEndMinutes'],
}

export const shiftSchema = shiftFields.refine(distinctEnds.check, {
  message: distinctEnds.message,
  path: distinctEnds.path,
})

export type ShiftValues = z.infer<typeof shiftSchema>

/** The shift modal also carries the two company-wide settings, saved alongside the shift. */
export const shiftFormSchema = shiftFields
  .extend({
    timeZone: z.string().min(1, 'Pick the zone the working day is counted in.'),
    isCompanyHours: z.boolean(),
  })
  .refine(distinctEnds.check, { message: distinctEnds.message, path: distinctEnds.path })

export type ShiftFormValues = z.infer<typeof shiftFormSchema>

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

export interface AttendanceHolidayRow {
  id: string
  date: string
  name: string
  /** Empty when everyone gets the day off. */
  country: string
  /** True when the public holiday calendar filled it in rather than an admin. */
  imported: boolean
}

export interface HolidayCountryOption {
  code: string
  name: string
}

export interface HolidayBook {
  holidays: AttendanceHolidayRow[]
  canManage: boolean
}

export const holidaySchema = z.object({
  holidayId: z.string().optional(),
  date: dateKey,
  name: z.string().trim().min(1, 'Name the holiday.').max(80, 'Keep the name under 80 characters.'),
  country: z.string().trim().toUpperCase().max(2),
})

export type HolidayValues = z.infer<typeof holidaySchema>

/** What a day an admin grants is called on the timesheet, since no request form named it. */
export function grantedDayOffName(paid: boolean) {
  return paid ? 'Paid day off' : 'Unpaid day off'
}

export const dayOffSchema = z.object({
  userId: z.string().min(1, 'Pick the person.'),
  workDate: dateKey,
})

export type DayOffValues = z.infer<typeof dayOffSchema>

export const grantDayOffSchema = dayOffSchema.extend({ paid: z.boolean() })

export type GrantDayOffValues = z.infer<typeof grantDayOffSchema>

export const importHolidaysSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  country: z.string().trim().toUpperCase().length(2, 'Pick a country.'),
})

export type ImportHolidaysValues = z.infer<typeof importHolidaysSchema>

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

/** The caller's own day on the calendar. */
export type CalendarDayState =
  'worked' | 'open' | 'absent' | 'leave' | 'holiday' | 'off' | 'scheduled'

export const CALENDAR_DAY_STATES: readonly CalendarDayState[] = [
  'worked',
  'open',
  'absent',
  'leave',
  'holiday',
  'off',
  'scheduled',
]

export interface CalendarHolidayRow {
  name: string
  /** ISO code, empty for a day off everyone gets. */
  country: string
}

export interface CalendarLeaveRow {
  userId: string
  userName: string
  name: string
}

export interface CalendarDayRow {
  date: string
  state: CalendarDayState
  workedSeconds: number
  holidays: CalendarHolidayRow[]
  leave: CalendarLeaveRow[]
}

export interface CalendarMonth {
  month: string
  today: string
  timeZone: string
  days: CalendarDayRow[]
  canManage: boolean
  /** True when the holidays and leave cover everyone, which is an admin reading their own month. */
  showsEveryone: boolean
}

/** A state worth showing on a team day; days off and days still to come are left out. */
export type TeamCalendarState = 'worked' | 'open' | 'absent' | 'leave' | 'holiday'

export const TEAM_CALENDAR_STATES: readonly TeamCalendarState[] = [
  'worked',
  'open',
  'absent',
  'leave',
  'holiday',
]

export interface TeamCalendarEntry {
  userId: string
  userName: string
  state: TeamCalendarState
  workedSeconds: number
  leaveName: string | undefined
}

export interface TeamCalendarDayRow {
  date: string
  holidays: CalendarHolidayRow[]
  people: TeamCalendarEntry[]
}

export interface TeamCalendarMonth {
  month: string
  today: string
  timeZone: string
  days: TeamCalendarDayRow[]
}

export const CORRECTION_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number]

export interface AttendanceCorrectionRow {
  id: string
  userId: string
  userName: string
  workDate: string
  clockInTime: string
  clockOutTime: string
  breakMinutes: number
  reason: string
  status: CorrectionStatus
  decidedBy: string | undefined
  decidedAt: string | undefined
  decisionNote: string | undefined
  createdAt: string
  /** An admin, on somebody else's pending request. */
  canDecide: boolean
  isMine: boolean
}

/**
 * What a member asks for: the day as it should read. Both ends are required, because a request
 * is about a day that is over — a running day is still theirs to clock out of.
 */
export const correctionSchema = z
  .object({
    workDate: dateKey,
    clockInTime: timeOfDay,
    clockOutTime: timeOfDay,
    breakMinutes: z
      .number()
      .int()
      .min(0, 'Break time cannot be negative.')
      .max(12 * 60, 'A break cannot run longer than half a day.'),
    reason: z
      .string()
      .trim()
      .min(1, 'Say what happened, so the admin can check it.')
      .max(300, 'Keep the reason under 300 characters.'),
  })
  .refine((values) => clockToMinutes(values.clockInTime) !== clockToMinutes(values.clockOutTime), {
    message: 'A day cannot start and end at the same minute.',
    path: ['clockOutTime'],
  })

export type CorrectionValues = z.infer<typeof correctionSchema>

export const CORRECTION_NEEDS_REASON =
  'Say why it was turned down, so they know what to do instead.'

export const correctionDecisionSchema = z
  .object({
    correctionId: z.string().min(1),
    decision: z.enum(['approved', 'rejected']),
    note: z.string().trim().max(300).default(''),
  })
  .refine((values) => values.decision !== 'rejected' || values.note.length > 0, {
    message: CORRECTION_NEEDS_REASON,
    path: ['note'],
  })

export type CorrectionDecisionValues = z.infer<typeof correctionDecisionSchema>

const cents = z.number().int().min(0, 'An amount cannot be negative.').max(100_000_000)

/**
 * A contractor's billing statement for a range: days and hours start from the timesheet, the
 * money is typed in, because rates and bonuses are not stored anywhere yet.
 */
export const billingStatementSchema = z.object({
  // Read from the profile, not typed: the server overwrites both with what is on file.
  contractorName: z.string().trim().max(120),
  position: z.string().trim().max(120),
  /** Set by an admin per contractor: one flat amount instead of days × a daily rate. */
  fixedPay: z.boolean(),
  invoiceNumber: z.string().trim().min(1, 'Enter an invoice number.').max(40),
  invoiceDate: dateKey,
  daysWorked: z.number().int().min(0, 'Days cannot be negative.').max(366),
  hoursWorked: z.number().min(0, 'Hours cannot be negative.').max(10_000),
  dailyRateCents: cents.refine((value) => value > 0, 'Enter your rate.'),
  bonusCents: cents,
  expenses: z
    .array(
      z.object({
        description: z.string().trim().min(1, 'Say what the expense was for.').max(120),
        amountCents: cents.refine((value) => value > 0, 'Enter the amount.'),
      }),
    )
    .max(20, 'Keep it to 20 expenses.'),
  wiseLink: z.url({
    protocol: /^https$/,
    error: 'Paste your Wise payment link, starting with https://.',
  }),
})

export type BillingStatementValues = z.infer<typeof billingStatementSchema>

/** What is stored: the form plus the range it billed, which the form reads from the page. */
export const savedStatementSchema = billingStatementSchema
  .extend({ periodStart: dateKey, periodEnd: dateKey })
  .refine((values) => values.periodStart <= values.periodEnd, {
    message: 'The billing period ends before it starts.',
    path: ['periodEnd'],
  })

export type SavedStatementValues = z.infer<typeof savedStatementSchema>

export const setPayTermsSchema = z.object({ userId: z.string().min(1), fixedPay: z.boolean() })
export type PayTermsRow = z.infer<typeof setPayTermsSchema>

/** A new statement's starting point: who is billing, and on which basis. */
export interface StatementDefaults {
  contractorName: string
  position: string
  fixedPay: boolean
}

export interface BillingStatementRow extends SavedStatementValues {
  id: string
  userId: string
  totalCents: number
  createdAt: string
}
