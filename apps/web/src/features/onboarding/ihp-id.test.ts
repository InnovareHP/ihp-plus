import { describe, expect, it } from 'vitest'
import { generateIhpId, IHP_ID_PATTERN } from './ihp-id'

describe('generateIhpId', () => {
  it('matches the printed company ID format', () => {
    expect(generateIhpId()).toMatch(IHP_ID_PATTERN)
  })

  it('never emits a character that can be misread on a card', () => {
    const suffixes = Array.from({ length: 200 }, () => generateIhpId().slice(4)).join('')
    expect(suffixes).not.toMatch(/[01OIL]/)
  })

  it('does not repeat across a run', () => {
    const ids = new Set(Array.from({ length: 500 }, generateIhpId))
    expect(ids.size).toBe(500)
  })
})
