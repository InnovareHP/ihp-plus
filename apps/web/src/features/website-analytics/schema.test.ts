import { describe, expect, it } from 'vitest'
import { EMPTY_TAKEAWAYS, hasTakeaways, pointsOf, splitLead } from './schema'

describe('takeaway text', () => {
  it('reads one point per line, whatever bullet was typed', () => {
    expect(pointsOf('- First\n\n* Second\n3. Third\n• Fourth\n  Fifth  ')).toEqual([
      'First',
      'Second',
      'Third',
      'Fourth',
      'Fifth',
    ])
  })

  it('finds a short label to bold, and leaves long or label-less points alone', () => {
    expect(splitLead('Traffic volume: 2,138 page views.')).toEqual({
      lead: 'Traffic volume',
      rest: '2,138 page views.',
    })
    expect(splitLead('No label here.')).toEqual({ lead: null, rest: 'No label here.' })
    expect(splitLead(`${'x'.repeat(70)}: too long to be a label`).lead).toBeNull()
  })

  it('knows when nothing has been written', () => {
    expect(hasTakeaways(EMPTY_TAKEAWAYS)).toBe(false)
    expect(hasTakeaways({ ...EMPTY_TAKEAWAYS, strengths: '  \n- ' })).toBe(false)
    expect(hasTakeaways({ ...EMPTY_TAKEAWAYS, strengths: 'Fast pages' })).toBe(true)
  })
})
