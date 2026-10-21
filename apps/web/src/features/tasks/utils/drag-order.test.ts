import { describe, expect, it } from 'vitest'
import type { TaskRow } from '../schema'
import { beforeTaskIdFor } from './drag-order'

const row = (id: string, listId = 'list-1') => ({ id, listId }) as TaskRow

describe('beforeTaskIdFor', () => {
  const column = [row('a'), row('b'), row('c'), row('d')]

  it('lands before the card that follows it in the shown order', () => {
    expect(beforeTaskIdFor(['b', 'a', 'c', 'd'], 'a', column, 'list-1')).toBe('c')
  })

  it('lands at the very end when nothing follows and nothing is hidden', () => {
    expect(beforeTaskIdFor(['b', 'c', 'd', 'a'], 'a', column, 'list-1')).toBeUndefined()
  })

  it('lands before the first hidden card when dropped at the end of a shortened column', () => {
    // Only a and b are shown; c and d sit behind "Show more".
    expect(beforeTaskIdFor(['b', 'a'], 'a', column, 'list-1')).toBe('c')
  })

  it('lands at the top of an empty column', () => {
    expect(beforeTaskIdFor(['x'], 'x', [], 'list-1')).toBeUndefined()
  })

  it('arriving from another column lands before the card it was dropped on', () => {
    expect(beforeTaskIdFor(['a', 'x', 'b'], 'x', column, 'list-1')).toBe('b')
  })

  it('skips cards from other lists so a hidden list keeps its order', () => {
    const mixed = [row('a'), row('o', 'list-2'), row('b')]
    expect(beforeTaskIdFor(['x', 'o', 'b'], 'x', mixed, 'list-1')).toBe('b')
  })
})
