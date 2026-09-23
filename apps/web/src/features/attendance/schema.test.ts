import { describe, expect, it } from 'vitest'
import {
  attendanceDaySchema,
  attendanceSettingsSchema,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_SHIFT,
  selfieProblem,
  shiftSchema,
} from './schema'

describe('attendanceSettingsSchema', () => {
  it('accepts the two things that are true of the whole company', () => {
    expect(attendanceSettingsSchema.parse(DEFAULT_ATTENDANCE_SETTINGS)).toEqual({
      timeZone: 'UTC',
      defaultShiftId: '',
    })
  })

  it('refuses a company with no zone to count its day in', () => {
    expect(attendanceSettingsSchema.safeParse({ timeZone: '', defaultShiftId: '' }).success).toBe(
      false,
    )
  })
})

describe('shiftSchema', () => {
  const shift = {
    name: 'Morning',
    shiftStartMinutes: DEFAULT_SHIFT.shiftStartMinutes,
    shiftEndMinutes: DEFAULT_SHIFT.shiftEndMinutes,
    graceMinutes: 15,
    workdays: '1,2,3,4,5',
    requireSelfie: true,
    requireNote: false,
    captureLocation: false,
    sendReminders: true,
    autoClockOutHours: 16,
  }

  it('carries the rules the clock runs under', () => {
    expect(shiftSchema.parse(shift)).toMatchObject({ requireSelfie: true, autoClockOutHours: 16 })
  })

  it('refuses a shift that starts and ends at the same minute', () => {
    const result = shiftSchema.safeParse({ ...shift, shiftEndMinutes: shift.shiftStartMinutes })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['shiftEndMinutes'])
  })

  it('refuses a week with no working days in it', () => {
    expect(shiftSchema.safeParse({ ...shift, workdays: '' }).success).toBe(false)
  })

  it('refuses an auto-close longer than a day', () => {
    expect(shiftSchema.safeParse({ ...shift, autoClockOutHours: 25 }).success).toBe(false)
  })
})

describe('attendanceDaySchema', () => {
  const day = {
    userId: 'user-1',
    workDate: '2026-09-22',
    clockInTime: '09:00',
    clockOutTime: '18:00',
    breakMinutes: 60,
    note: '',
  }

  it('takes a day somebody wrote up', () => {
    expect(attendanceDaySchema.parse(day)).toMatchObject({ breakMinutes: 60 })
  })

  it('leaves the day running when no end is typed', () => {
    expect(attendanceDaySchema.parse({ ...day, clockOutTime: '' }).clockOutTime).toBe('')
  })

  it('refuses a date that is not one', () => {
    expect(attendanceDaySchema.safeParse({ ...day, workDate: '22/09/2026' }).success).toBe(false)
  })

  it('refuses a day that starts and ends at the same minute', () => {
    expect(attendanceDaySchema.safeParse({ ...day, clockOutTime: '09:00' }).success).toBe(false)
  })
})

describe('selfieProblem', () => {
  it('takes the JPEG the camera produces', () => {
    expect(selfieProblem(new File(['x'], 'selfie.jpg', { type: 'image/jpeg' }))).toBeUndefined()
  })

  it('turns away anything else', () => {
    expect(selfieProblem(new File(['x'], 'scan.pdf', { type: 'application/pdf' }))).toBe(
      'A selfie must be a JPEG, PNG or WebP photo.',
    )
  })
})
