import { describe, expect, it } from 'vitest'
import { safeLibraryName } from './library-name'

describe('safeLibraryName', () => {
  it('keeps an ordinary file name as it is', () => {
    expect(safeLibraryName('Time-off policy.pdf')).toBe('Time-off policy.pdf')
  })

  it('replaces the characters SharePoint refuses', () => {
    expect(safeLibraryName('Q1: margins <draft>?.xlsx')).toBe('Q1- margins -draft--.xlsx')
  })

  it('drops leading and trailing dots, which break the sync client', () => {
    expect(safeLibraryName('..notes..')).toBe('notes')
  })

  it('falls back rather than returning an empty name', () => {
    expect(safeLibraryName('   ')).toBe('file')
  })

  it('stays inside the length SharePoint allows', () => {
    expect(safeLibraryName('a'.repeat(300))).toHaveLength(200)
  })
})
