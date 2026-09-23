import type {
  AttendanceBoardRow as AttendanceBoardRowMessage,
  AttendanceDay as AttendanceDayMessage,
  AttendanceHoliday as AttendanceHolidayMessage,
  AttendanceSchedule as AttendanceScheduleMessage,
  AttendanceSettings as AttendanceSettingsMessage,
  AttendanceShift as AttendanceShiftMessage,
} from '@ihp/rpc/attendance'
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_SHIFT,
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

function stateOf(value: string): AttendanceState {
  return value === 'in' || value === 'break' || value === 'out' ? value : 'absent'
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
  }
}

export function holidayToProto(holiday: AttendanceHolidayRow): AttendanceHolidayMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceHoliday',
    id: holiday.id,
    date: holiday.date,
    name: holiday.name,
  }
}

export function holidayFromProto(holiday: AttendanceHolidayMessage): AttendanceHolidayRow {
  return { id: holiday.id, date: holiday.date, name: holiday.name }
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
  }
}

export function boardRowFromProto(row: AttendanceBoardRowMessage): AttendanceBoardRow {
  return {
    userId: row.userId,
    userName: row.userName,
    jobTitle: row.jobTitle,
    day: row.day ? dayFromProto(row.day) : undefined,
    state: stateOf(row.state),
  }
}
