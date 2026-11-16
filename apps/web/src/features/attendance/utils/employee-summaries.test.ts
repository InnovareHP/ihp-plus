import { describe, expect, it } from 'vitest'
import type { AttendanceAbsenceRow, AttendanceDayRow, BillingStatementRow } from '../schema'
import { employeeSummaries } from './employee-summaries'

const day = (userId: string, workDate: string, hours: number) =>
  ({ userId, workDate, workedSeconds: hours * 3600 }) as AttendanceDayRow

const paidLeave = (userId: string, workDate: string) =>
  ({ userId, workDate, kind: 'leave', paid: true }) as AttendanceAbsenceRow

describe('employeeSummaries', () => {
  it('gives each person their own time, tasks and statements, tasks oldest day first', () => {
    const statement = { id: 'st-1', userId: 'dana' } as BillingStatementRow
    const [dana, eli] = employeeSummaries({
      people: [
        { userId: 'dana', userName: 'Dana', jobTitle: 'Nurse' },
        { userId: 'eli', userName: 'Eli', jobTitle: undefined },
      ],
      days: [
        day('dana', '2026-11-02', 8),
        day('dana', '2026-11-03', 7.5),
        day('eli', '2026-11-02', 4),
      ],
      absences: [paidLeave('dana', '2026-11-04')],
      tasks: [
        { id: 't2', name: 'Later', dueDate: '2026-11-03', isDone: false, assigneeIds: ['dana'] },
        { id: 't1', name: 'Earlier', dueDate: '2026-11-02', isDone: true, assigneeIds: ['dana'] },
        { id: 't3', name: 'Elis', dueDate: '2026-11-02', isDone: true, assigneeIds: ['eli'] },
      ],
      statements: [statement],
    })

    expect(dana).toMatchObject({ daysWorked: 3, hoursWorked: 15.5, paidDaysOff: 1 })
    expect(dana?.tasks.map((task) => task.name)).toEqual(['Earlier', 'Later'])
    expect(dana?.statements).toEqual([statement])
    expect(eli).toMatchObject({ daysWorked: 1, hoursWorked: 4, statements: [] })
    expect(eli?.tasks).toEqual([{ id: 't3', name: 'Elis', dueDate: '2026-11-02', isDone: true }])
  })
})
