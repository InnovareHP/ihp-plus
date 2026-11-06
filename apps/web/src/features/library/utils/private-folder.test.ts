import { describe, expect, it } from 'vitest'
import { isExecutivePath, isExecutiveRoot, itemLibraryPath } from './private-folder'

describe('isExecutivePath', () => {
  it('matches the folder and everything under it, in any case', () => {
    expect(isExecutivePath('Executive')).toBe(true)
    expect(isExecutivePath('executive/Board/minutes.pdf')).toBe(true)
    expect(isExecutivePath('/../Executive')).toBe(true)
  })

  it('leaves other folders and nested look-alikes alone', () => {
    expect(isExecutivePath('')).toBe(false)
    expect(isExecutivePath('Executives')).toBe(false)
    expect(isExecutivePath('Clients/Executive')).toBe(false)
  })
})

describe('isExecutiveRoot', () => {
  it('is the folder itself, not its contents', () => {
    expect(isExecutiveRoot('Executive')).toBe(true)
    expect(isExecutiveRoot('Executive/plan.pdf')).toBe(false)
  })
})

describe('itemLibraryPath', () => {
  it('rebuilds the path from the parent Graph reports', () => {
    const item = { id: '1', name: 'plan.pdf', parentReference: { path: '/drive/root:/Executive' } }
    expect(itemLibraryPath(item as never)).toBe('Executive/plan.pdf')
  })
})
