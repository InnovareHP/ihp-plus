import { describe, expect, it } from 'vitest'
import {
  joinLibraryPath,
  librarySegments,
  libraryTrail,
  normalizeLibraryPath,
  parentLibraryPath,
} from './library-path'

describe('librarySegments', () => {
  it('drops empty, current and parent segments', () => {
    expect(librarySegments('/Clients//Acme/')).toEqual(['Clients', 'Acme'])
    expect(librarySegments('Clients/../../etc')).toEqual(['Clients', 'etc'])
    expect(librarySegments('')).toEqual([])
  })
})

describe('normalizeLibraryPath', () => {
  it('rebuilds a traversal attempt as a path inside the library', () => {
    expect(normalizeLibraryPath('../../Clients/Acme')).toBe('Clients/Acme')
  })
})

describe('joinLibraryPath', () => {
  it('appends a child to the folder being read', () => {
    expect(joinLibraryPath('', 'Clients')).toBe('Clients')
    expect(joinLibraryPath('Clients', 'Acme Corp')).toBe('Clients/Acme Corp')
  })
})

describe('parentLibraryPath', () => {
  it('climbs one folder and stops at the root', () => {
    expect(parentLibraryPath('Clients/Acme')).toBe('Clients')
    expect(parentLibraryPath('Clients')).toBe('')
    expect(parentLibraryPath('')).toBe('')
  })
})

describe('libraryTrail', () => {
  it('names every ancestor with the path that opens it', () => {
    expect(libraryTrail('Clients/Acme')).toEqual([
      { label: 'Internal library', path: '' },
      { label: 'Clients', path: 'Clients' },
      { label: 'Acme', path: 'Clients/Acme' },
    ])
  })

  it('is the root alone at the top of the library', () => {
    expect(libraryTrail('')).toEqual([{ label: 'Internal library', path: '' }])
  })
})
