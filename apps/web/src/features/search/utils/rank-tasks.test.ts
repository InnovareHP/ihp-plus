import { describe, expect, it } from 'vitest'
import { rankTasks, taskNumberOf } from './rank-tasks'

function task(taskNumber: number, name: string) {
  return { taskNumber, name }
}

describe('taskNumberOf', () => {
  it('reads "#12" and "12" as task number 12', () => {
    expect(taskNumberOf('#12')).toBe(12)
    expect(taskNumberOf(' 12 ')).toBe(12)
  })

  it('treats anything else as a name search', () => {
    expect(taskNumberOf('12a')).toBeNull()
    expect(taskNumberOf('#')).toBeNull()
    expect(taskNumberOf('renewal')).toBeNull()
  })
})

describe('rankTasks', () => {
  // Input order stands for "most recently updated first", as the service fetches them.
  const TASKS = [
    task(30, 'Chase the renewal invoice'),
    task(12, 'Book the venue'),
    task(5, 'Renewal'),
    task(9, 'Renewal pack for Acme'),
    task(41, 'Prerenewal checklist'),
  ]

  it('puts the exact task number first', () => {
    expect(rankTasks(TASKS, '#12', 10)[0]).toEqual(task(12, 'Book the venue'))
  })

  it('ranks exact name, then name start, then word start, then anywhere', () => {
    // The database only returns name matches, so the venue task is not a candidate here.
    const matches = TASKS.filter((one) => one.name.toLowerCase().includes('renewal'))

    expect(rankTasks(matches, 'renewal', 10).map((one) => one.taskNumber)).toEqual([5, 9, 30, 41])
  })

  it('ignores case and accents', () => {
    expect(rankTasks([task(1, 'Peña follow-up')], 'PENA', 10)).toHaveLength(1)
  })

  it('keeps the most recently updated first among equal matches', () => {
    const tied = [task(2, 'Renewal call'), task(1, 'Renewal email')]

    expect(rankTasks(tied, 'renewal', 10).map((one) => one.taskNumber)).toEqual([2, 1])
  })

  it('stops at the limit', () => {
    expect(rankTasks(TASKS, 'renewal', 2)).toHaveLength(2)
  })
})
