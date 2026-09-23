import { describe, expect, it } from 'vitest'
import { dueReminders, sentKey, type OrgSnapshot, type Person, type ShiftRules } from './reminders'

const DAY_SHIFT: ShiftRules = {
  name: 'Morning',
  shiftStartMinutes: 9 * 60,
  shiftEndMinutes: 18 * 60,
  graceMinutes: 15,
  workdays: '1,2,3,4,5',
  autoClockOutHours: 16,
  sendReminders: true,
  holidayCountry: 'PH',
}

const GRACE: Person = {
  userId: 'u-1',
  email: 'grace@ihp.test',
  firstName: 'Grace',
  since: '2026-01-01',
  shift: DAY_SHIFT,
}

function org(overrides: Partial<OrgSnapshot> = {}): OrgSnapshot {
  return {
    organizationId: 'org-1',
    timeZone: 'Asia/Manila',
    people: [GRACE],
    holidaysToday: [],
    onLeaveToday: new Set(),
    clockedToday: new Set(),
    openDays: [],
    sent: new Set(),
    ...overrides,
  }
}

// Thursday 24 September 2026 in Manila (UTC+8).
const at = (time: string) => new Date(`2026-09-24T${time}:00+08:00`)

describe('clock-in reminders', () => {
  it('waits out the grace period, then reminds once', () => {
    expect(dueReminders(org(), at('09:14'))).toEqual([])

    const [due] = dueReminders(org(), at('09:16'))
    expect(due).toMatchObject({
      kind: 'clock_in',
      userId: 'u-1',
      workDate: '2026-09-24',
      at: '09:00',
    })

    const sent = new Set([sentKey('u-1', '2026-09-24', 'clock_in')])
    expect(dueReminders(org({ sent }), at('09:30'))).toEqual([])
  })

  it('reads the day in the company zone, not UTC', () => {
    // 01:30 UTC on the 24th is 09:30 in Manila; UTC would still say it is the middle of the night.
    const [due] = dueReminders(org(), new Date('2026-09-24T01:30:00Z'))
    expect(due?.workDate).toBe('2026-09-24')
  })

  it('stays quiet for anyone clocked in, on leave, off today, not started, or on a holiday', () => {
    const now = at('10:00')
    expect(dueReminders(org({ clockedToday: new Set(['u-1']) }), now)).toEqual([])
    expect(dueReminders(org({ onLeaveToday: new Set(['u-1']) }), now)).toEqual([])
    const holiday = { date: '2026-09-24', name: 'Company day', country: '' }
    expect(dueReminders(org({ holidaysToday: [holiday] }), now)).toEqual([])
    expect(dueReminders(org({ people: [{ ...GRACE, since: '2026-09-25' }] }), now)).toEqual([])
    expect(dueReminders(org(), new Date('2026-09-26T10:00:00+08:00'))).toEqual([])
  })

  it('still reminds on another country’s holiday, but not on the shift’s own', () => {
    const now = at('10:00')
    const us = { date: '2026-09-24', name: 'US holiday', country: 'US' }
    const ph = { date: '2026-09-24', name: 'PH holiday', country: 'PH' }

    expect(dueReminders(org({ holidaysToday: [us] }), now)).toHaveLength(1)
    expect(dueReminders(org({ holidaysToday: [ph] }), now)).toEqual([])
  })

  it('stays quiet when the shift has reminders off, and once a day shift is over', () => {
    const quiet = { ...GRACE, shift: { ...DAY_SHIFT, sendReminders: false } }
    expect(dueReminders(org({ people: [quiet] }), at('10:00'))).toEqual([])
    expect(dueReminders(org(), at('18:30'))).toEqual([])
  })

  it('still reminds a night shift after midnight has not come yet', () => {
    const night = {
      ...GRACE,
      shift: { ...DAY_SHIFT, shiftStartMinutes: 22 * 60, shiftEndMinutes: 6 * 60 },
    }
    expect(dueReminders(org({ people: [night] }), at('22:10'))).toEqual([])
    expect(dueReminders(org({ people: [night] }), at('22:20'))).toHaveLength(1)
  })
})

describe('clock-out reminders', () => {
  const open = { userId: 'u-1', workDate: '2026-09-24', clockInAt: at('09:00') }

  it('waits 30 minutes past the shift end, then says when the clock will close the day', () => {
    expect(
      dueReminders(org({ openDays: [open], clockedToday: new Set(['u-1']) }), at('18:20')),
    ).toEqual([])

    const [due] = dueReminders(
      org({ openDays: [open], clockedToday: new Set(['u-1']) }),
      at('18:31'),
    )
    expect(due).toMatchObject({ kind: 'clock_out', at: '18:00', closesAt: '01:00' })
  })

  it('sends once per day, and never after the clock has closed the day itself', () => {
    const sent = new Set([sentKey('u-1', '2026-09-24', 'clock_out')])
    expect(dueReminders(org({ openDays: [open], sent }), at('19:00'))).toEqual([])
    expect(dueReminders(org({ openDays: [open] }), new Date('2026-09-25T02:00:00+08:00'))).toEqual(
      [],
    )
  })

  it('waits for a night shift to end on the next morning', () => {
    const night = {
      ...GRACE,
      shift: { ...DAY_SHIFT, shiftStartMinutes: 22 * 60, shiftEndMinutes: 6 * 60 },
    }
    const started = { userId: 'u-1', workDate: '2026-09-24', clockInAt: at('22:00') }
    const snapshot = org({ people: [night], openDays: [started], clockedToday: new Set(['u-1']) })

    expect(dueReminders(snapshot, new Date('2026-09-25T06:10:00+08:00'))).toEqual([])
    expect(dueReminders(snapshot, new Date('2026-09-25T06:40:00+08:00'))).toMatchObject([
      { kind: 'clock_out', workDate: '2026-09-24', at: '06:00' },
    ])
  })

  it('leaves the auto-close out when the shift never closes a day', () => {
    const never = { ...GRACE, shift: { ...DAY_SHIFT, autoClockOutHours: 0 } }
    const [due] = dueReminders(org({ people: [never], openDays: [open] }), at('19:00'))
    expect(due?.closesAt).toBeUndefined()
  })
})
