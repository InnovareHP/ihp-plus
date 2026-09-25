import { describe, expect, it } from 'vitest'
import { insertMention, matchesMention, mentionQueryAt } from './mention-query'

describe('mentionQueryAt', () => {
  it('opens on a bare @ at the caret', () => {
    expect(mentionQueryAt('Thanks @', 8)).toEqual({ start: 7, text: '' })
  })

  it('carries what has been typed after it', () => {
    expect(mentionQueryAt('Thanks @gra', 11)).toEqual({ start: 7, text: 'gra' })
  })

  it('allows the second word of a name', () => {
    expect(mentionQueryAt('cc @Grace Rey', 13)).toEqual({ start: 3, text: 'Grace Rey' })
  })

  it('stays shut mid-word, where an email lives', () => {
    expect(mentionQueryAt('write to grace@innovarehp.com', 29)).toBeUndefined()
  })

  it('closes once the name is followed by a sentence', () => {
    expect(mentionQueryAt('@Grace Reyes please look', 24)).toBeUndefined()
  })

  it('reads the caret, not the end of the text', () => {
    expect(mentionQueryAt('@gr and more', 3)).toEqual({ start: 0, text: 'gr' })
  })
})

describe('insertMention', () => {
  it('replaces the half-typed name and leaves a space to carry on', () => {
    const query = mentionQueryAt('Thanks @gra', 11)
    expect(query && insertMention('Thanks @gra', query, 'Grace Reyes')).toEqual({
      value: 'Thanks @Grace Reyes ',
      caret: 20,
    })
  })

  it('keeps what follows the caret', () => {
    const query = mentionQueryAt('cc @gr for this', 6)
    expect(query && insertMention('cc @gr for this', query, 'Grace Reyes')?.value).toBe(
      'cc @Grace Reyes  for this',
    )
  })
})

describe('matchesMention', () => {
  it('matches on any part of the name, whatever the case', () => {
    expect(matchesMention('Grace Reyes', 'rey')).toBe(true)
    expect(matchesMention('Grace Reyes', 'GRACE')).toBe(true)
    expect(matchesMention('Grace Reyes', 'ana')).toBe(false)
  })

  it('matches everyone while nothing is typed', () => {
    expect(matchesMention('Grace Reyes', '')).toBe(true)
  })
})
