'use client'

import { ConnectError } from '@ihp/rpc'
import {
  boardRowFromProto,
  dayFromProto,
  scheduleFromProto,
  settingsFromProto,
  settingsToProto,
  shiftFromProto,
} from '@/rpc/attendance-codec'
import { browserClients } from '@/rpc/browser'
import type {
  AttendanceBoard,
  AttendanceDayRow,
  AttendanceDayValues,
  AttendanceLog,
  AttendanceScheduleRow,
  AttendanceSettingsRow,
  AttendanceSettingsView,
  AttendanceShiftRow,
  AssignShiftValues,
  ClockActionValues,
  ShiftValues,
  TimeClockView,
} from './schema'

/**
 * ConnectError stringifies as "[not_found] ...", putting a machine code in front of a sentence a
 * user reads. What reaches the UI is the plain message.
 */
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

function requiredDay(day: Parameters<typeof dayFromProto>[0] | undefined): AttendanceDayRow {
  if (!day) throw new Error('The server did not return the day.')
  return dayFromProto(day)
}

export async function getAttendanceSettings(): Promise<AttendanceSettingsView> {
  const response = await call(() => browserClients.attendance.getAttendanceSettings({}))
  return { settings: settingsFromProto(response.settings), canManage: response.canManage }
}

export async function updateAttendanceSettings(
  settings: AttendanceSettingsRow,
): Promise<AttendanceSettingsRow> {
  const response = await call(() =>
    browserClients.attendance.updateAttendanceSettings({ settings: settingsToProto(settings) }),
  )
  return settingsFromProto(response.settings)
}

export async function getTimeClock(): Promise<TimeClockView> {
  const response = await call(() => browserClients.attendance.getTimeClock({}))
  return {
    today: response.today ? dayFromProto(response.today) : undefined,
    settings: settingsFromProto(response.settings),
    schedule: scheduleFromProto(response.schedule),
    canManage: response.canManage,
  }
}

export async function clockIn(values: ClockActionValues): Promise<AttendanceDayRow> {
  const response = await call(() =>
    browserClients.attendance.clockIn({
      selfieKey: values.selfieKey,
      location: values.location,
      note: values.note,
    }),
  )
  return requiredDay(response.day)
}

export async function clockOut(values: ClockActionValues): Promise<AttendanceDayRow> {
  const response = await call(() =>
    browserClients.attendance.clockOut({
      selfieKey: values.selfieKey,
      location: values.location,
      note: values.note,
    }),
  )
  return requiredDay(response.day)
}

export async function startBreak(): Promise<AttendanceDayRow> {
  const response = await call(() => browserClients.attendance.startBreak({}))
  return requiredDay(response.day)
}

export async function endBreak(): Promise<AttendanceDayRow> {
  const response = await call(() => browserClients.attendance.endBreak({}))
  return requiredDay(response.day)
}

export interface AttendanceRange {
  from: string
  to: string
  userId?: string
  everyone?: boolean
}

export async function listAttendance(range: AttendanceRange): Promise<AttendanceLog> {
  const response = await call(() =>
    browserClients.attendance.listAttendance({
      from: range.from,
      to: range.to,
      userId: range.userId,
      everyone: range.everyone ?? false,
    }),
  )
  return {
    days: response.days.map(dayFromProto),
    totalWorkedSeconds: response.totalWorkedSeconds,
    totalBreakSeconds: response.totalBreakSeconds,
    totalLateSeconds: response.totalLateSeconds,
  }
}

export async function getAttendanceBoard(date: string): Promise<AttendanceBoard> {
  const response = await call(() => browserClients.attendance.getAttendanceBoard({ date }))
  return {
    rows: response.rows.map(boardRowFromProto),
    date: response.date,
    presentCount: response.presentCount,
    lateCount: response.lateCount,
    absentCount: response.absentCount,
  }
}

export async function saveAttendanceDay(values: AttendanceDayValues): Promise<AttendanceDayRow> {
  const response = await call(() =>
    browserClients.attendance.saveAttendanceDay({
      dayId: values.dayId,
      userId: values.userId,
      workDate: values.workDate,
      clockInTime: values.clockInTime,
      clockOutTime: values.clockOutTime,
      breakMinutes: values.breakMinutes,
      note: values.note,
    }),
  )
  return requiredDay(response.day)
}

export async function deleteAttendanceDay(dayId: string): Promise<void> {
  await call(() => browserClients.attendance.deleteAttendanceDay({ dayId }))
}

export interface ScheduleBookView {
  schedules: AttendanceScheduleRow[]
  settings: AttendanceSettingsRow
  shifts: AttendanceShiftRow[]
}

export async function listSchedules(): Promise<ScheduleBookView> {
  const response = await call(() => browserClients.attendance.listSchedules({}))
  return {
    schedules: response.schedules.map(scheduleFromProto),
    settings: settingsFromProto(response.settings),
    shifts: response.shifts.map(shiftFromProto),
  }
}

export interface ShiftBookView {
  shifts: AttendanceShiftRow[]
  settings: AttendanceSettingsRow
}

export async function listShifts(): Promise<ShiftBookView> {
  const response = await call(() => browserClients.attendance.listShifts({}))
  return {
    shifts: response.shifts.map(shiftFromProto),
    settings: settingsFromProto(response.settings),
  }
}

export async function saveShift(values: ShiftValues): Promise<AttendanceShiftRow> {
  const response = await call(() =>
    browserClients.attendance.saveShift({
      shiftId: values.shiftId,
      name: values.name,
      shiftStartMinutes: values.shiftStartMinutes,
      shiftEndMinutes: values.shiftEndMinutes,
      graceMinutes: values.graceMinutes,
      workdays: values.workdays,
    }),
  )
  if (!response.shift) throw new Error('The server did not return the shift.')
  return shiftFromProto(response.shift)
}

export async function deleteShift(shiftId: string): Promise<void> {
  await call(() => browserClients.attendance.deleteShift({ shiftId }))
}

export async function assignShift(values: AssignShiftValues): Promise<AttendanceScheduleRow> {
  const response = await call(() =>
    browserClients.attendance.assignShift({
      userId: values.userId,
      shiftId: values.shiftId || undefined,
    }),
  )
  return scheduleFromProto(response.schedule)
}
