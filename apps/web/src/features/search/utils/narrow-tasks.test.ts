import { describe, expect, it } from 'vitest'
import type { SearchTask } from '../schema'
import { narrowFromCache } from './narrow-tasks'

function task(taskNumber: number, name: string): SearchTask {
  return {
    taskId: `task-${taskNumber}`,
    taskNumber,
    name,
    projectId: 'project-1',
    projectName: 'Renewals',
    statusName: 'To do',
    statusColor: '#95E5DC',
  }
}

const COMPLETE = {
  query: 'ren',
  tasks: [task(1, 'Renewal pack'), task(2, 'Rent the hall')],
  fresh: true,
}

describe('narrowFromCache', () => {
  it('answers a longer query from a complete shorter one, with no request', () => {
    expect(narrowFromCache([COMPLETE], 'renew', 8)?.map((one) => one.name)).toEqual([
      'Renewal pack',
    ])
  })

  it('ignores case the way the server does', () => {
    expect(narrowFromCache([COMPLETE], 'RENEW', 8)).toHaveLength(1)
  })

  it('will not narrow from an answer that hit the limit, since rows may be missing', () => {
    const full = { ...COMPLETE, tasks: Array.from({ length: 8 }, (_, i) => task(i, `Renew ${i}`)) }

    expect(narrowFromCache([full], 'renew', 8)).toBeNull()
  })

  it('will not narrow from an answer older than the freshness window', () => {
    expect(narrowFromCache([{ ...COMPLETE, fresh: false }], 'renew', 8)).toBeNull()
  })

  it('leaves a number search to the server, which also matches task numbers', () => {
    const digits = { ...COMPLETE, query: '1' }

    expect(narrowFromCache([digits], '12', 8)).toBeNull()
    expect(narrowFromCache([COMPLETE], '#1', 8)).toBeNull()
  })

  it('leaves the exact query to its own cache entry', () => {
    expect(narrowFromCache([COMPLETE], 'ren', 8)).toBeNull()
  })

  it('narrows from the longest usable earlier query', () => {
    const shorter = { query: 're', tasks: [task(9, 'Renewal from re')], fresh: true }
    const longer = { query: 'rene', tasks: [task(1, 'Renewal pack')], fresh: true }

    expect(narrowFromCache([shorter, longer], 'renew', 8)?.map((one) => one.taskNumber)).toEqual([
      1,
    ])
  })
})
