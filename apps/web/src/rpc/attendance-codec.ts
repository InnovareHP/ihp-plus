import type {
  AttendanceAbsence as AttendanceAbsenceMessage,
  AttendanceCorrection as AttendanceCorrectionMessage,
  CalendarDay as CalendarDayMessage,
  TeamCalendarDay as TeamCalendarDayMessage,
  AttendanceBoardRow as AttendanceBoardRowMessage,
  AttendanceDay as AttendanceDayMessage,
  AttendanceHoliday as AttendanceHolidayMessage,
  AttendanceSchedule as AttendanceScheduleMessage,
  AttendanceSettings as AttendanceSettingsMessage,
  AttendanceShift as AttendanceShiftMessage,
} from '@ihp/rpc/attendance'
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  CALENDAR_DAY_STATES,
  CORRECTION_STATUSES,
  type AttendanceCorrectionRow,
  DEFAULT_SHIFT,
  type CalendarDayRow,
  TEAM_CALENDAR_STATES,
  type TeamCalendarDayRow,
  type AttendanceAbsenceRow,
  type AttendanceBoardRow,
  type AttendanceDayRow,
  type AttendanceHolidayRow,
  type AttendanceScheduleRow,
  type AttendanceSettingsRow,
  type AttendanceShiftRow,
  type AttendanceSource,
  type AttendanceState,
  type AttendanceStatus,
} from '@/features/attendance/schema'

// The wire carries the words the database stores; the UI keeps its unions, and an unknown value
// from an older client falls back rather than throwing.
function statusOf(value: string): AttendanceStatus {
  return value === 'open' ? 'open' : 'recorded'
}

function sourceOf(value: string): AttendanceSource {
  return value === 'manual' ? 'manual' : 'clock'
}

const STATES: readonly AttendanceState[] = [
  'in',
  'break',
  'out',
  'absent',
  'leave',
  'holiday',
  'off',
  'expected',
]

function stateOf(value: string): AttendanceState {
  return STATES.find((state) => state === value) ?? 'absent'
}

export function dayToProto(day: AttendanceDayRow): AttendanceDayMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceDay',
    id: day.id,
    userId: day.userId,
    userName: day.userName,
    workDate: day.workDate,
    clockInAt: day.clockInAt,
    clockOutAt: day.clockOutAt,
    workedSeconds: day.workedSeconds,
    breakSeconds: day.breakSeconds,
    lateSeconds: day.lateSeconds,
    status: day.status,
    source: day.source,
    note: day.note,
    clockInSelfieUrl: day.clockInSelfieUrl,
    clockOutSelfieUrl: day.clockOutSelfieUrl,
    clockInLocation: day.clockInLocation,
    clockOutLocation: day.clockOutLocation,
    isOpen: day.isOpen,
    onBreak: day.onBreak,
    breaks: day.breaks.map((one) => ({
      $typeName: 'ihp.attendance.v1.AttendanceBreak' as const,
      id: one.id,
      startedAt: one.startedAt,
      endedAt: one.endedAt,
      seconds: one.seconds,
      isRunning: one.isRunning,
    })),
    autoClosed: day.autoClosed,
  }
}

export function dayFromProto(day: AttendanceDayMessage): AttendanceDayRow {
  return {
    id: day.id,
    userId: day.userId,
    userName: day.userName,
    workDate: day.workDate,
    clockInAt: day.clockInAt,
    clockOutAt: day.clockOutAt,
    workedSeconds: day.workedSeconds,
    breakSeconds: day.breakSeconds,
    lateSeconds: day.lateSeconds,
    status: statusOf(day.status),
    source: sourceOf(day.source),
    note: day.note,
    clockInSelfieUrl: day.clockInSelfieUrl,
    clockOutSelfieUrl: day.clockOutSelfieUrl,
    clockInLocation: day.clockInLocation,
    clockOutLocation: day.clockOutLocation,
    isOpen: day.isOpen,
    onBreak: day.onBreak,
    breaks: day.breaks.map((one) => ({
      id: one.id,
      startedAt: one.startedAt,
      endedAt: one.endedAt,
      seconds: one.seconds,
      isRunning: one.isRunning,
    })),
    autoClosed: day.autoClosed,
  }
}

export function absenceToProto(absence: AttendanceAbsenceRow): AttendanceAbsenceMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceAbsence',
    userId: absence.userId,
    userName: absence.userName,
    workDate: absence.workDate,
    kind: absence.kind,
    leaveName: absence.leaveName,
    granted: absence.granted,
    paid: absence.paid,
  }
}

export function absenceFromProto(absence: AttendanceAbsenceMessage): AttendanceAbsenceRow {
  return {
    userId: absence.userId,
    userName: absence.userName,
    workDate: absence.workDate,
    kind: absence.kind === 'leave' ? 'leave' : 'absent',
    leaveName: absence.leaveName,
    granted: absence.granted,
    paid: absence.paid,
  }
}

export function holidayToProto(holiday: AttendanceHolidayRow): AttendanceHolidayMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceHoliday',
    id: holiday.id,
    date: holiday.date,
    name: holiday.name,
    country: holiday.country,
    imported: holiday.imported,
  }
}

export function holidayFromProto(holiday: AttendanceHolidayMessage): AttendanceHolidayRow {
  return {
    id: holiday.id,
    date: holiday.date,
    name: holiday.name,
    country: holiday.country,
    imported: holiday.imported,
  }
}

export function settingsToProto(settings: AttendanceSettingsRow): AttendanceSettingsMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceSettings',
    timeZone: settings.timeZone,
    defaultShiftId: settings.defaultShiftId || undefined,
  }
}

export function settingsFromProto(
  settings: AttendanceSettingsMessage | undefined,
): AttendanceSettingsRow {
  if (!settings) return DEFAULT_ATTENDANCE_SETTINGS

  return {
    timeZone: settings.timeZone || DEFAULT_ATTENDANCE_SETTINGS.timeZone,
    defaultShiftId: settings.defaultShiftId ?? '',
  }
}

export function shiftToProto(shift: AttendanceShiftRow): AttendanceShiftMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceShift',
    id: shift.id,
    name: shift.name,
    shiftStartMinutes: shift.shiftStartMinutes,
    shiftEndMinutes: shift.shiftEndMinutes,
    graceMinutes: shift.graceMinutes,
    workdays: shift.workdays,
    assignedCount: shift.assignedCount,
    requireSelfie: shift.requireSelfie,
    requireNote: shift.requireNote,
    captureLocation: shift.captureLocation,
    autoClockOutHours: shift.autoClockOutHours,
    isDefault: shift.isDefault,
    sendReminders: shift.sendReminders,
    holidayCountry: shift.holidayCountry,
  }
}

export function shiftFromProto(shift: AttendanceShiftMessage | undefined): AttendanceShiftRow {
  if (!shift) return DEFAULT_SHIFT

  return {
    id: shift.id,
    name: shift.name,
    shiftStartMinutes: shift.shiftStartMinutes,
    shiftEndMinutes: shift.shiftEndMinutes,
    graceMinutes: shift.graceMinutes,
    workdays: shift.workdays,
    assignedCount: shift.assignedCount,
    requireSelfie: shift.requireSelfie,
    requireNote: shift.requireNote,
    captureLocation: shift.captureLocation,
    autoClockOutHours: shift.autoClockOutHours,
    isDefault: shift.isDefault,
    sendReminders: shift.sendReminders,
    holidayCountry: shift.holidayCountry,
  }
}

export function scheduleToProto(schedule: AttendanceScheduleRow): AttendanceScheduleMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceSchedule',
    userId: schedule.userId,
    userName: schedule.userName,
    shiftStartMinutes: schedule.shiftStartMinutes,
    shiftEndMinutes: schedule.shiftEndMinutes,
    graceMinutes: schedule.graceMinutes,
    workdays: schedule.workdays,
    isDefault: schedule.isDefault,
    shiftId: schedule.shiftId,
    shiftName: schedule.shiftName,
    jobTitle: schedule.jobTitle,
  }
}

export function scheduleFromProto(
  schedule: AttendanceScheduleMessage | undefined,
): AttendanceScheduleRow {
  // The built-in hours stand in when the server sent nothing, which is a client older than this.
  return {
    userId: schedule?.userId ?? '',
    userName: schedule?.userName ?? '',
    shiftStartMinutes: schedule?.shiftStartMinutes ?? DEFAULT_SHIFT.shiftStartMinutes,
    shiftEndMinutes: schedule?.shiftEndMinutes ?? DEFAULT_SHIFT.shiftEndMinutes,
    graceMinutes: schedule?.graceMinutes ?? DEFAULT_SHIFT.graceMinutes,
    workdays: schedule?.workdays || DEFAULT_SHIFT.workdays,
    isDefault: schedule?.isDefault ?? true,
    shiftId: schedule?.shiftId,
    shiftName: schedule?.shiftName,
    jobTitle: schedule?.jobTitle,
  }
}

export function boardRowToProto(row: AttendanceBoardRow): AttendanceBoardRowMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceBoardRow',
    userId: row.userId,
    userName: row.userName,
    jobTitle: row.jobTitle,
    day: row.day ? dayToProto(row.day) : undefined,
    state: row.state,
    offReason: row.offReason,
  }
}

export function boardRowFromProto(row: AttendanceBoardRowMessage): AttendanceBoardRow {
  return {
    userId: row.userId,
    userName: row.userName,
    jobTitle: row.jobTitle,
    day: row.day ? dayFromProto(row.day) : undefined,
    state: stateOf(row.state),
    offReason: row.offReason,
  }
}

export function calendarDayToProto(day: CalendarDayRow): CalendarDayMessage {
  return {
    $typeName: 'ihp.attendance.v1.CalendarDay',
    date: day.date,
    state: day.state,
    workedSeconds: day.workedSeconds,
    holidays: day.holidays.map((one) => ({
      $typeName: 'ihp.attendance.v1.CalendarHoliday' as const,
      name: one.name,
      country: one.country,
    })),
    leave: day.leave.map((one) => ({
      $typeName: 'ihp.attendance.v1.CalendarLeave' as const,
      userId: one.userId,
      userName: one.userName,
      name: one.name,
    })),
  }
}

export function calendarDayFromProto(day: CalendarDayMessage): CalendarDayRow {
  return {
    date: day.date,
    // An unknown state from a newer server reads as an ordinary scheduled day.
    state: CALENDAR_DAY_STATES.find((state) => state === day.state) ?? 'scheduled',
    workedSeconds: day.workedSeconds,
    holidays: day.holidays.map((one) => ({ name: one.name, country: one.country })),
    leave: day.leave.map((one) => ({ userId: one.userId, userName: one.userName, name: one.name })),
  }
}

export function teamCalendarDayToProto(day: TeamCalendarDayRow): TeamCalendarDayMessage {
  return {
    $typeName: 'ihp.attendance.v1.TeamCalendarDay',
    date: day.date,
    holidays: day.holidays.map((one) => ({
      $typeName: 'ihp.attendance.v1.CalendarHoliday' as const,
      name: one.name,
      country: one.country,
    })),
    people: day.people.map((one) => ({
      $typeName: 'ihp.attendance.v1.TeamCalendarEntry' as const,
      userId: one.userId,
      userName: one.userName,
      state: one.state,
      workedSeconds: one.workedSeconds,
      leaveName: one.leaveName,
    })),
  }
}

export function teamCalendarDayFromProto(day: TeamCalendarDayMessage): TeamCalendarDayRow {
  return {
    date: day.date,
    holidays: day.holidays.map((one) => ({ name: one.name, country: one.country })),
    // A state this client does not know is left off rather than miscounted.
    people: day.people.flatMap((one) => {
      const state = TEAM_CALENDAR_STATES.find((known) => known === one.state)
      return state
        ? [
            {
              userId: one.userId,
              userName: one.userName,
              state,
              workedSeconds: one.workedSeconds,
              leaveName: one.leaveName,
            },
          ]
        : []
    }),
  }
}

export function correctionToProto(row: AttendanceCorrectionRow): AttendanceCorrectionMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceCorrection',
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    workDate: row.workDate,
    clockInTime: row.clockInTime,
    clockOutTime: row.clockOutTime,
    breakMinutes: row.breakMinutes,
    reason: row.reason,
    status: row.status,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
    canDecide: row.canDecide,
    isMine: row.isMine,
  }
}

export function correctionFromProto(message: AttendanceCorrectionMessage): AttendanceCorrectionRow {
  return {
    id: message.id,
    userId: message.userId,
    userName: message.userName,
    workDate: message.workDate,
    clockInTime: message.clockInTime,
    clockOutTime: message.clockOutTime,
    breakMinutes: message.breakMinutes,
    reason: message.reason,
    // An unknown status from a newer server reads as still waiting, the safe assumption.
    status: CORRECTION_STATUSES.find((status) => status === message.status) ?? 'pending',
    decidedBy: message.decidedBy,
    decidedAt: message.decidedAt,
    decisionNote: message.decisionNote,
    createdAt: message.createdAt,
    canDecide: message.canDecide,
    isMine: message.isMine,
  }
}
