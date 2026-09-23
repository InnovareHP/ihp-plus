import type { AttendanceAbsenceRow } from '../schema'
import { isWorkday, shiftDateKey } from './clock'

export interface RosterPerson {
  userId: string
  userName: string
  /** The shift's working days, "1,2,3,4,5". */
  workdays: string
  /** The first date they could have been expected in: joined, or started, whichever is later. */
  since: string
}

export interface AbsenceInput {
  people: readonly RosterPerson[]
  from: string
  to: string
  /** Dates before this are settled; today is still running, so it is never counted. */
  today: string
  holidays: ReadonlySet<string>
  /** Keyed `${userId}|${date}`, valued with the leave's name. */
  leave: ReadonlyMap<string, string>
  /** Keyed `${userId}|${date}` for every day with a clock-in. */
  worked: ReadonlySet<string>
}

export function personDateKey(userId: string, date: string) {
  return `${userId}|${date}`
}

/**
 * Every scheduled day nobody clocked, newest first: leave where it was approved, absent where it
 * was not. A holiday or a day outside the shift is nobody's absence.
 */
export function absencesOf(input: AbsenceInput): AttendanceAbsenceRow[] {
  const yesterday = shiftDateKey(input.today, -1)
  const last = input.to < yesterday ? input.to : yesterday
  const rows: AttendanceAbsenceRow[] = []

  for (const person of input.people) {
    const first = input.from > person.since ? input.from : person.since

    for (let date = first; date <= last; date = shiftDateKey(date, 1)) {
      if (!isWorkday(date, person.workdays)) continue
      if (input.holidays.has(date)) continue

      const key = personDateKey(person.userId, date)
      if (input.worked.has(key)) continue

      const leaveName = input.leave.get(key)
      rows.push({
        userId: person.userId,
        userName: person.userName,
        workDate: date,
        kind: leaveName ? 'leave' : 'absent',
        leaveName,
      })
    }
  }

  return rows.sort(
    (a, b) => b.workDate.localeCompare(a.workDate) || a.userName.localeCompare(b.userName),
  )
}
