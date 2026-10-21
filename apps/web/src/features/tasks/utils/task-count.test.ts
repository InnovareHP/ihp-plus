import { describe, expect, it } from 'vitest'
import { taskCount } from './task-count'

describe('taskCount', () => {
  it('says "task" for one and "tasks" otherwise', () => {
    expect(taskCount(0)).toBe('0 tasks')
    expect(taskCount(1)).toBe('1 task')
    expect(taskCount(12)).toBe('12 tasks')
  })
})
