import type { ServiceImpl } from '@ihp/rpc'
import { AttendanceService } from '@ihp/rpc/attendance'
import {
  assignShift,
  clockIn,
  clockOut,
  deleteAttendanceDay,
  deleteShift,
  endBreak,
  loadAttendance,
  loadAttendanceSettings,
  loadBoard,
  loadSchedules,
  loadShifts,
  loadTimeClock,
  saveAttendanceDay,
  saveAttendanceSettings,
  saveShift,
  startBreak,
} from '@/features/attendance/service'
import {
  boardRowToProto,
  dayToProto,
  scheduleToProto,
  settingsFromProto,
  settingsToProto,
  shiftToProto,
} from './attendance-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const attendance: ServiceImpl<typeof AttendanceService> = {
  getAttendanceSettings: async () => {
    const view = await loadAttendanceSettings()
    return { settings: settingsToProto(view.settings), canManage: view.canManage }
  },

  updateAttendanceSettings: async (request) => ({
    settings: settingsToProto(await saveAttendanceSettings(settingsFromProto(request.settings))),
  }),

  getTimeClock: async () => {
    const view = await loadTimeClock()
    return {
      today: view.today ? dayToProto(view.today) : undefined,
      settings: settingsToProto(view.settings),
      schedule: scheduleToProto(view.schedule),
      canManage: view.canManage,
      shift: shiftToProto(view.shift),
    }
  },

  clockIn: async (request) => ({
    day: dayToProto(
      await clockIn({
        selfieKey: request.selfieKey ?? '',
        location: request.location ?? '',
        note: request.note ?? '',
      }),
    ),
  }),

  clockOut: async (request) => ({
    day: dayToProto(
      await clockOut({
        selfieKey: request.selfieKey ?? '',
        location: request.location ?? '',
        note: request.note ?? '',
      }),
    ),
  }),

  startBreak: async () => ({ day: dayToProto(await startBreak()) }),

  endBreak: async () => ({ day: dayToProto(await endBreak()) }),

  listAttendance: async (request) => {
    const log = await loadAttendance({
      from: request.from,
      to: request.to,
      userId: request.userId,
      everyone: request.everyone,
    })
    return {
      days: log.days.map(dayToProto),
      totalWorkedSeconds: log.totalWorkedSeconds,
      totalBreakSeconds: log.totalBreakSeconds,
      totalLateSeconds: log.totalLateSeconds,
    }
  },

  getAttendanceBoard: async (request) => {
    const board = await loadBoard(request.date)
    return {
      rows: board.rows.map(boardRowToProto),
      date: board.date,
      presentCount: board.presentCount,
      lateCount: board.lateCount,
      absentCount: board.absentCount,
    }
  },

  saveAttendanceDay: async (request) => ({
    day: dayToProto(
      await saveAttendanceDay({
        dayId: request.dayId,
        userId: request.userId,
        workDate: request.workDate,
        clockInTime: request.clockInTime,
        clockOutTime: request.clockOutTime ?? '',
        breakMinutes: request.breakMinutes,
        note: request.note ?? '',
      }),
    ),
  }),

  deleteAttendanceDay: async (request) => {
    await deleteAttendanceDay(request.dayId)
    return {}
  },

  listSchedules: async () => {
    const book = await loadSchedules()
    return {
      schedules: book.schedules.map(scheduleToProto),
      settings: settingsToProto(book.settings),
      shifts: book.shifts.map(shiftToProto),
    }
  },

  listShifts: async () => {
    const book = await loadShifts()
    return { shifts: book.shifts.map(shiftToProto), settings: settingsToProto(book.settings) }
  },

  saveShift: async (request) => ({
    shift: shiftToProto(
      await saveShift({
        shiftId: request.shiftId,
        name: request.name,
        shiftStartMinutes: request.shiftStartMinutes,
        shiftEndMinutes: request.shiftEndMinutes,
        graceMinutes: request.graceMinutes,
        workdays: request.workdays,
        requireSelfie: request.requireSelfie,
        requireNote: request.requireNote,
        captureLocation: request.captureLocation,
        autoClockOutHours: request.autoClockOutHours,
      }),
    ),
  }),

  deleteShift: async (request) => {
    await deleteShift(request.shiftId)
    return {}
  },

  assignShift: async (request) => ({
    schedule: scheduleToProto(
      await assignShift({ userId: request.userId, shiftId: request.shiftId ?? '' }),
    ),
  }),
}
