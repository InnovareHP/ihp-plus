import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SearchEntry } from '../schema'
import {
  clearRecentSearches,
  readRecent,
  recentKey,
  rememberRecent,
  subscribeRecent,
} from './recent-searches'

const KEY = recentKey('org-1', 'user-1')

function page(id: string): SearchEntry {
  return { id, kind: 'page', label: id, href: `/${id}` }
}

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('recent searches', () => {
  it('keeps the newest first without repeating an entry', () => {
    rememberRecent(KEY, page('tasks'))
    rememberRecent(KEY, page('clients'))
    rememberRecent(KEY, page('tasks'))

    expect(readRecent(KEY).map((one) => one.id)).toEqual(['tasks', 'clients'])
  })

  it('keeps only the last five', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) rememberRecent(KEY, page(id))

    expect(readRecent(KEY).map((one) => one.id)).toEqual(['f', 'e', 'd', 'c', 'b'])
  })

  it('keeps one list per person per organization', () => {
    rememberRecent(KEY, page('tasks'))

    expect(readRecent(recentKey('org-1', 'user-2'))).toEqual([])
    expect(readRecent(recentKey('org-2', 'user-1'))).toEqual([])
  })

  it('returns the same array until the list changes', () => {
    rememberRecent(KEY, page('tasks'))

    expect(readRecent(KEY)).toBe(readRecent(KEY))
  })

  it('drops a stored list pointing outside the app', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([{ id: 'x', kind: 'page', label: 'x', href: '//evil.example' }]),
    )

    expect(readRecent(KEY)).toEqual([])
  })

  it('treats unreadable storage as an empty list', () => {
    window.localStorage.setItem(KEY, '{not json')
    expect(readRecent(KEY)).toEqual([])

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readRecent(recentKey('org-9', 'user-9'))).toEqual([])
  })

  it('clears every recent list on sign-out and nothing else', () => {
    rememberRecent(KEY, page('tasks'))
    rememberRecent(recentKey('org-2', 'user-2'), page('clients'))
    window.localStorage.setItem('unrelated', 'kept')

    clearRecentSearches()

    expect(readRecent(KEY)).toEqual([])
    expect(window.localStorage.getItem('unrelated')).toBe('kept')
  })

  it('tells subscribers when the list changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeRecent(listener)

    rememberRecent(KEY, page('tasks'))
    unsubscribe()
    rememberRecent(KEY, page('clients'))

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
