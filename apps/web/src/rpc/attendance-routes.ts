import { Code, ConnectError, type ServiceImpl } from '@ihp/rpc'
import { AttendanceService } from '@ihp/rpc/attendance'
import {
  assignShift,
  clockIn,
  clockOut,
  deleteAttendanceDay,
  deleteHoliday,
  deleteShift,
  endBreak,
  grantDayOff,
  revokeDayOff,
  importHolidays,
  listHolidayCountries,
  loadAttendance,
  loadAttendanceSettings,
  loadBoard,
  decideCorrection,
  loadCalendar,
  loadCorrections,
  requestCorrection,
  withdrawCorrection,
  loadTeamCalendar,
  loadHolidays,
  loadSchedules,
  loadShifts,
  loadTimeClock,
  saveAttendanceDay,
  saveAttendanceSettings,
  saveHoliday,
  saveShift,
  startBreak,
  saveBillingStatement,
  loadBillingStatements,
  deleteBillingStatement,
  loadPayTerms,
  setPayTerms,
  loadStatementDefaults,
} from '@/features/attendance/service'
import {
  absenceToProto,
  boardRowToProto,
  calendarDayToProto,
  correctionToProto,
  teamCalendarDayToProto,
  dayToProto,
  holidayToProto,
  scheduleToProto,
  settingsFromProto,
  settingsToProto,
  shiftToProto,
  statementFromProto,
  statementToProto,
} from './attendance-codec'

// Thin by design: every implementation converts at the wire boundary and delegates to the
// feature's service, so the business rules stay testable without a transport.
export const attendance: ServiceImpl<typeof AttendanceService> = {
  requestCorrection: async (request) => ({
    correction: correctionToProto(
      await requestCorrection({
        workDate: request.workDate,
        clockInTime: request.clockInTime,
        clockOutTime: request.clockOutTime,
        breakMinutes: request.breakMinutes,
        reason: request.reason,
      }),
    ),
  }),

  listCorrections: async (request) => ({
    corrections: (
      await loadCorrections({ everyone: request.everyone, status: request.status })
    ).map(correctionToProto),
  }),

  decideCorrection: async (request) => ({
    correction: correctionToProto(
      await decideCorrection({
        correctionId: request.correctionId,
        // Anything but an approval is read as a rejection, which then needs its reason.
        decision: request.decision === 'approved' ? 'approved' : 'rejected',
        note: request.note,
      }),
    ),
  }),

  withdrawCorrection: async (request) => ({
    correction: correctionToProto(await withdrawCorrection(request.correctionId)),
  }),

  getCalendar: async (request) => {
    const calendar = await loadCalendar(request.month, request.userId)
    return {
      month: calendar.month,
      today: calendar.today,
      timeZone: calendar.timeZone,
      days: calendar.days.map(calendarDayToProto),
      canManage: calendar.canManage,
      showsEveryone: calendar.showsEveryone,
    }
  },

  getTeamCalendar: async (request) => {
    const calendar = await loadTeamCalendar(request.month)
    return {
      month: calendar.month,
      today: calendar.today,
      timeZone: calendar.timeZone,
      days: calendar.days.map(teamCalendarDayToProto),
    }
  },

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
      holidayName: view.holidayName,
      leaveName: view.leaveName,
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
      absences: log.absences.map(absenceToProto),
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
      leaveCount: board.leaveCount,
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

  grantDayOff: async (request) => {
    await grantDayOff({ userId: request.userId, workDate: request.workDate, paid: request.paid })
    return {}
  },

  revokeDayOff: async (request) => {
    await revokeDayOff({ userId: request.userId, workDate: request.workDate })
    return {}
  },

  saveBillingStatement: async (request) => {
    if (!request.statement) {
      throw new ConnectError('Send the statement to save.', Code.InvalidArgument)
    }
    return {
      statement: statementToProto(
        await saveBillingStatement(statementFromProto(request.statement)),
      ),
    }
  },

  listBillingStatements: async () => ({
    statements: (await loadBillingStatements()).map(statementToProto),
  }),

  deleteBillingStatement: async (request) => {
    await deleteBillingStatement(request.statementId)
    return {}
  },

  listPayTerms: async () => ({
    payTerms: (await loadPayTerms()).map((terms) => ({
      $typeName: 'ihp.attendance.v1.PayTerms' as const,
      ...terms,
    })),
  }),

  setPayTerms: async (request) => ({
    payTerms: {
      $typeName: 'ihp.attendance.v1.PayTerms' as const,
      ...(await setPayTerms({ userId: request.userId, fixedPay: request.fixedPay })),
    },
  }),

  getStatementDefaults: async () => loadStatementDefaults(),

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
        sendReminders: request.sendReminders,
        holidayCountry: request.holidayCountry,
      }),
    ),
  }),

  deleteShift: async (request) => {
    await deleteShift(request.shiftId)
    return {}
  },

  listHolidays: async (request) => {
    const book = await loadHolidays(request.year)
    return { holidays: book.holidays.map(holidayToProto), canManage: book.canManage }
  },

  saveHoliday: async (request) => ({
    holiday: holidayToProto(
      await saveHoliday({
        holidayId: request.holidayId,
        date: request.date,
        name: request.name,
        country: request.country,
      }),
    ),
  }),

  deleteHoliday: async (request) => {
    await deleteHoliday(request.holidayId)
    return {}
  },

  listHolidayCountries: async () => ({ countries: await listHolidayCountries() }),

  importHolidays: async (request) => ({
    added: (await importHolidays({ year: request.year, country: request.country })).map(
      holidayToProto,
    ),
  }),

  assignShift: async (request) => ({
    schedule: scheduleToProto(
      await assignShift({ userId: request.userId, shiftId: request.shiftId ?? '' }),
    ),
  }),
}
