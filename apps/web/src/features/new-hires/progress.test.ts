import { describe, expect, it } from 'vitest'
import { doneCountOf, progressOf, stuckOnOf, type HireFacts } from './progress'

const SETTLED: HireFacts = {
  phone: '+63 917 000 0000',
  photoKey: 'photos/a.jpg',
  teamIds: ['team-it'],
  shiftName: 'Morning',
  acknowledgedDocumentIds: new Set(['doc-handbook']),
  completedTaskIds: new Set(['task-laptop']),
}

const HANDBOOK = { id: 'doc-handbook', title: 'Handbook', teamIds: [] }
const FINANCE_POLICY = { id: 'doc-finance', title: 'Expense policy', teamIds: ['team-finance'] }
const LAPTOP = { id: 'task-laptop', title: 'Collect your laptop', description: null }

describe('progressOf', () => {
  it('marks every step done for a hire who has finished them', () => {
    const progress = progressOf(SETTLED, [HANDBOOK], [LAPTOP])

    expect(doneCountOf(progress)).toBe(4)
    expect(stuckOnOf(progress)).toBeUndefined()
  })

  it('names the profile fields still missing', () => {
    const progress = progressOf({ ...SETTLED, phone: '  ', photoKey: null }, [], [])

    expect(progress.profile).toEqual({ done: false, missing: ['phone', 'photo'] })
    expect(stuckOnOf(progress)).toBe('profile')
  })

  it('asks a hire to read only what their department shelves reach', () => {
    const progress = progressOf(SETTLED, [HANDBOOK, FINANCE_POLICY], [])

    expect(progress.reading.documents.map((document) => document.id)).toEqual(['doc-handbook'])
    expect(progress.reading.done).toBe(true)
  })

  it('holds reading open until every reachable document is acknowledged', () => {
    const progress = progressOf(
      { ...SETTLED, teamIds: ['team-finance'] },
      [HANDBOOK, FINANCE_POLICY],
      [],
    )

    expect(progress.reading.done).toBe(false)
    expect(progress.reading.documents).toEqual([
      { id: 'doc-handbook', title: 'Handbook', acknowledged: true },
      { id: 'doc-finance', title: 'Expense policy', acknowledged: false },
    ])
  })

  it('waits on a shift until one is assigned, and stops at the first open step', () => {
    const progress = progressOf(
      { ...SETTLED, shiftName: undefined, completedTaskIds: new Set() },
      [],
      [LAPTOP],
    )

    expect(progress.shift.done).toBe(false)
    expect(progress.tasks.items).toEqual([
      { id: 'task-laptop', title: 'Collect your laptop', description: undefined, done: false },
    ])
    expect(stuckOnOf(progress)).toBe('shift')
    expect(doneCountOf(progress)).toBe(2)
  })

  it('counts nothing to read or tick off as done', () => {
    const progress = progressOf(SETTLED, [], [])

    expect(progress.reading.done).toBe(true)
    expect(progress.tasks.done).toBe(true)
  })
})
