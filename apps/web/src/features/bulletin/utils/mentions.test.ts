import { describe, expect, it } from 'vitest'
import { MENTION_EVERYONE } from '@/lib/mentions'
import { keepMentionedIds } from './mentions'

const PEOPLE = [
  { userId: 'user-2', name: 'Grace Hopper' },
  { userId: 'user-3', name: 'Ada' },
]

describe('keepMentionedIds', () => {
  it('keeps a name still in the text and drops one that was deleted', () => {
    expect(keepMentionedIds('Thanks @Grace Hopper!', ['user-2', 'user-3'], PEOPLE)).toEqual([
      'user-2',
    ])
  })

  it('matches whatever case the name was left in', () => {
    expect(keepMentionedIds('cc @ada', ['user-3'], PEOPLE)).toEqual(['user-3'])
  })

  it('keeps @everyone only while it is written', () => {
    expect(keepMentionedIds('Heads up @everyone', [MENTION_EVERYONE], PEOPLE)).toEqual([
      MENTION_EVERYONE,
    ])
    expect(keepMentionedIds('Heads up', [MENTION_EVERYONE], PEOPLE)).toEqual([])
  })

  it('drops an id for someone no longer on the list', () => {
    expect(keepMentionedIds('@Gone', ['user-9'], PEOPLE)).toEqual([])
  })
})
