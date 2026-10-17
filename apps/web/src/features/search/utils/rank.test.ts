import { describe, expect, it } from 'vitest'
import type { SearchEntry } from '../schema'
import { rankEntries } from './rank'

function entry(label: string, description = '', keywords: string[] = []): SearchEntry {
  return { id: label, kind: 'page', label, description, href: '/', keywords }
}

const ENTRIES = [
  entry('Bulletin board', 'Company news'),
  entry('Time clock › Leave', 'Days left on each kind of leave'),
  entry('Clients', 'Accounts and follow-ups'),
  entry('Clients › Contracts', 'Accounts and follow-ups'),
  entry('Peña reports', ''),
  entry('Library', 'Shared files', ['Workspace']),
]

function labels(query: string, limit = 10) {
  return rankEntries(ENTRIES, query, limit).map((one) => one.label)
}

describe('rankEntries', () => {
  it('puts an exact label first, then a label that starts with the query', () => {
    expect(labels('clients').slice(0, 2)).toEqual(['Clients', 'Clients › Contracts'])
  })

  it('matches the start of any word in the label', () => {
    expect(labels('contr')).toEqual(['Clients › Contracts'])
  })

  it('ranks a label match above a description match', () => {
    expect(labels('leave')).toEqual(['Time clock › Leave'])
    expect(labels('news')).toEqual(['Bulletin board'])
  })

  it('matches keywords', () => {
    expect(labels('workspace')).toEqual(['Library'])
  })

  it('ignores case and accents', () => {
    expect(labels('PENA')).toEqual(['Peña reports'])
  })

  it('matches every word of a multi-word query anywhere', () => {
    expect(labels('clock days')).toEqual(['Time clock › Leave'])
  })

  it('returns nothing when nothing matches', () => {
    expect(labels('payroll')).toEqual([])
  })

  it('returns the first entries for an empty query, capped at the limit', () => {
    expect(labels('  ', 2)).toEqual(['Bulletin board', 'Time clock › Leave'])
  })
})
