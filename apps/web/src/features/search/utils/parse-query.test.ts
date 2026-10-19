import { describe, expect, it } from 'vitest'
import { parseQuery } from './parse-query'

describe('parseQuery', () => {
  it('reads each prefix as a scope and keeps the rest as the text', () => {
    expect(parseQuery('>task')).toEqual({ scope: 'actions', text: 'task' })
    expect(parseQuery('/leave')).toEqual({ scope: 'pages', text: 'leave' })
    expect(parseQuery('@ grace ')).toEqual({ scope: 'people', text: 'grace' })
    expect(parseQuery('$acme')).toEqual({ scope: 'clients', text: 'acme' })
    expect(parseQuery('#renewal')).toEqual({ scope: 'tasks', text: 'renewal' })
  })

  it('keeps "#12" a task-number search', () => {
    expect(parseQuery('#12')).toEqual({ scope: 'tasks', text: '12' })
  })

  it('searches everything when there is no prefix', () => {
    expect(parseQuery('  grace hopper ')).toEqual({ scope: null, text: 'grace hopper' })
  })

  it('takes a prefix alone as "list this kind"', () => {
    expect(parseQuery('@')).toEqual({ scope: 'people', text: '' })
  })

  it('reads a prefix after a leading space', () => {
    expect(parseQuery(' @bob')).toEqual({ scope: 'people', text: 'bob' })
  })

  it('only reads a prefix at the start', () => {
    expect(parseQuery('acme @ home')).toEqual({ scope: null, text: 'acme @ home' })
  })
})
