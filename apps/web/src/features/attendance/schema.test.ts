import { describe, expect, it } from 'vitest'
import {
  attendanceDaySchema,
  attendanceSettingsSchema,
  DEFAULT_ATTENDANCE_SETTINGS,
  selfieProblem,
} from './schema'

describe('attendanceSettingsSchema', () => {
  it('accepts the rules an organization starts with', () => {
    expect(attendanceSettingsSchema.parse(DEFAULT_ATTENDANCE_SETTINGS)).toMatchObject({
      shiftStartMinutes: 540,
    })
  })

  it('refuses a shift that starts and ends at the same minute', () => {
    const result = attendanceSettingsSchema.safeParse({
      ...DEFAULT_ATTENDANCE_SETTINGS,
      shiftEndMinutes: DEFAULT_ATTENDANCE_SETTINGS.shiftStartMinutes,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['shiftEndMinutes'])
  })

  it('refuses a week with no working days in it', () => {
    const result = attendanceSettingsSchema.safeParse({
      ...DEFAULT_ATTENDANCE_SETTINGS,
      workdays: '',
    })

    expect(result.success).toBe(false)
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
      'A selfie must be a JPEG photo.',
    )
  })
})
