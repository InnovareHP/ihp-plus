import { describe, expect, it } from 'vitest'
import type { DriveItem } from '@ihp/graph'
import { isSyncJunk, mirrorTargetOf, parentSegmentsOf, pathFromRoot } from './mirror-path'

function item(name: string, parentPath: string, extra: Partial<DriveItem> = {}): DriveItem {
  return { id: 'item-1', name, parentReference: { path: parentPath }, ...extra }
}

describe('isSyncJunk', () => {
  it.each(['~$report.docx', '.~lock.odt', 'draft.tmp', 'notes (Sam conflicted copy).docx'])(
    'skips %s, which the sync client made rather than a person',
    (name) => {
      expect(isSyncJunk(name)).toBe(true)
    },
  )

  it('keeps a real document', () => {
    expect(isSyncJunk('Statement of work.docx')).toBe(false)
  })
})

describe('pathFromRoot', () => {
  it('reads the path Graph writes after the root marker', () => {
    expect(pathFromRoot(item('a.docx', '/drive/root:/Clients/Acme/Shared'))).toBe(
      'Clients/Acme/Shared',
    )
  })

  it('decodes a folder name with a space in it', () => {
    expect(pathFromRoot(item('a.docx', '/drive/root:/Clients/Acme%20Group/Shared'))).toBe(
      'Clients/Acme Group/Shared',
    )
  })

  it('is undefined for an item delta reported without a parent', () => {
    expect(pathFromRoot({ id: 'i', name: 'a.docx' })).toBeUndefined()
  })
})

describe('mirrorTargetOf', () => {
  it('mirrors a file sitting directly in a client’s folder', () => {
    expect(mirrorTargetOf(item('sow.pdf', '/drive/root:/Clients/Acme'))).toEqual({
      clientFolder: 'Acme',
      relativePath: 'sow.pdf',
    })
  })

  it('keeps the subfolders a client’s documents are filed in', () => {
    expect(mirrorTargetOf(item('q1.xlsx', '/drive/root:/Clients/Acme/Reports/2026'))).toEqual({
      clientFolder: 'Acme',
      relativePath: 'Reports/2026/q1.xlsx',
    })
  })

  it('treats the client folder itself as the client’s root', () => {
    expect(mirrorTargetOf(item('Acme', '/drive/root:/Clients'))).toEqual({
      clientFolder: 'Acme',
      relativePath: '',
    })
  })

  it('leaves the Clients folder itself alone', () => {
    expect(mirrorTargetOf(item('Clients', '/drive/root:'))).toBeNull()
  })

  it('leaves a file that is not under Clients at all internal', () => {
    expect(mirrorTargetOf(item('handbook.pdf', '/drive/root:/Bluebook'))).toBeNull()
  })

  it('does not mirror the sync client’s leftovers', () => {
    expect(mirrorTargetOf(item('~$sow.docx', '/drive/root:/Clients/Acme'))).toBeNull()
  })
})

describe('parentSegmentsOf', () => {
  it('is empty for a file sitting directly in the client folder', () => {
    expect(parentSegmentsOf({ clientFolder: 'Acme', relativePath: 'sow.pdf' })).toEqual([])
  })

  it('names the folders that have to exist before a nested file lands', () => {
    expect(
      parentSegmentsOf({ clientFolder: 'Acme', relativePath: 'Reports/2026/q1.xlsx' }),
    ).toEqual(['Reports', '2026'])
  })
})
