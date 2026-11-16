import { describe, expect, it } from 'vitest'
import { completionRate, dailyTaskKpis } from './daily-task-kpis'

const PEOPLE = [
  { userId: 'dana', userName: 'Dana', jobTitle: undefined },
  { userId: 'eli', userName: 'Eli', jobTitle: 'Nurse' },
]

describe('dailyTaskKpis', () => {
  it('counts days, plans, completions and overdue per person', () => {
    const rows = dailyTaskKpis(
      PEOPLE,
      ['dana', 'dana', 'stranger'],
      [
        { dueDate: '2026-11-14', isDone: true, assigneeIds: ['dana'] },
        { dueDate: '2026-11-14', isDone: false, assigneeIds: ['dana'] },
        { dueDate: '2026-11-16', isDone: false, assigneeIds: ['dana'] },
        { dueDate: '2026-11-14', isDone: true, assigneeIds: ['stranger'] },
      ],
      '2026-11-16',
    )

    expect(rows).toEqual([
      { ...PEOPLE[0], daysWorked: 2, planned: 3, completed: 1, overdue: 1 },
      { ...PEOPLE[1], daysWorked: 0, planned: 0, completed: 0, overdue: 0 },
    ])
  })
})

describe('completionRate', () => {
  it('rounds to a whole percent and has none when nothing was planned', () => {
    expect(completionRate(2, 3)).toBe(67)
    expect(completionRate(0, 0)).toBeUndefined()
  })
})
