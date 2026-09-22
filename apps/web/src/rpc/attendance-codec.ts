import type {
  AttendanceBoardRow as AttendanceBoardRowMessage,
  AttendanceDay as AttendanceDayMessage,
  AttendanceSchedule as AttendanceScheduleMessage,
  AttendanceSettings as AttendanceSettingsMessage,
} from '@ihp/rpc/attendance'
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceBoardRow,
  type AttendanceDayRow,
  type AttendanceScheduleRow,
  type AttendanceSettingsRow,
  type AttendanceSource,
  type AttendanceState,
  type AttendanceStatus,
} from '@/features/attendance/schema'

// The wire carries the words the database stores; the UI keeps its unions, and an unknown value
// from an older client falls back rather than throwing.
function statusOf(value: string): AttendanceStatus {
  return value === 'open' || value === 'approved' ? value : 'recorded'
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
    approvedByName: day.approvedByName,
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
    approvedByName: day.approvedByName,
    breaks: day.breaks.map((one) => ({
      id: one.id,
      startedAt: one.startedAt,
      endedAt: one.endedAt,
      seconds: one.seconds,
      isRunning: one.isRunning,
    })),
  }
}

export function settingsToProto(settings: AttendanceSettingsRow): AttendanceSettingsMessage {
  return {
    $typeName: 'ihp.attendance.v1.AttendanceSettings',
    requireSelfie: settings.requireSelfie,
    allowManualEntry: settings.allowManualEntry,
    requireNote: settings.requireNote,
    captureLocation: settings.captureLocation,
    autoClockOutHours: settings.autoClockOutHours,
    shiftStartMinutes: settings.shiftStartMinutes,
    shiftEndMinutes: settings.shiftEndMinutes,
    graceMinutes: settings.graceMinutes,
    workdays: settings.workdays,
    timeZone: settings.timeZone,
  }
}

export function settingsFromProto(
  settings: AttendanceSettingsMessage | undefined,
): AttendanceSettingsRow {
  if (!settings) return DEFAULT_ATTENDANCE_SETTINGS

  return {
    requireSelfie: settings.requireSelfie,
    allowManualEntry: settings.allowManualEntry,
    requireNote: settings.requireNote,
    captureLocation: settings.captureLocation,
    autoClockOutHours: settings.autoClockOutHours,
    shiftStartMinutes: settings.shiftStartMinutes,
    shiftEndMinutes: settings.shiftEndMinutes,
    graceMinutes: settings.graceMinutes,
    workdays: settings.workdays || DEFAULT_ATTENDANCE_SETTINGS.workdays,
    timeZone: settings.timeZone || DEFAULT_ATTENDANCE_SETTINGS.timeZone,
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
  }
}

export function scheduleFromProto(
  schedule: AttendanceScheduleMessage | undefined,
): AttendanceScheduleRow {
  const settings = settingsFromProto(undefined)
  return {
    userId: schedule?.userId ?? '',
    userName: schedule?.userName ?? '',
    shiftStartMinutes: schedule?.shiftStartMinutes ?? settings.shiftStartMinutes,
    shiftEndMinutes: schedule?.shiftEndMinutes ?? settings.shiftEndMinutes,
    graceMinutes: schedule?.graceMinutes ?? settings.graceMinutes,
    workdays: schedule?.workdays || settings.workdays,
    isDefault: schedule?.isDefault ?? true,
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
