import { describe, expect, it } from 'vitest'
import { MENTION_EVERYONE } from '../schema'
import { mentionsEveryone } from './mentions'

describe('mentionsEveryone', () => {
  it('is the picked option', () => {
    expect(mentionsEveryone('Ready for review.', [MENTION_EVERYONE])).toBe(true)
  })

  it('is the word typed in the comment, whatever its case', () => {
    expect(mentionsEveryone('@Everyone please read this.', [])).toBe(true)
    expect(mentionsEveryone('Heads up @everyone', [])).toBe(true)
  })

  it('is not a name that merely starts the same way', () => {
    expect(mentionsEveryone('@everyones problem', [])).toBe(false)
    expect(mentionsEveryone('email everyone@example.com', [])).toBe(false)
  })

  it('is not a normal mention', () => {
    expect(mentionsEveryone('@Grace can you confirm', ['user-2'])).toBe(false)
  })
})
