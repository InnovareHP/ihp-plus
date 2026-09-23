import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, draftKey, readDraft, writeDraft } from './draft'

describe('onboarding draft', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('round-trips the answers but never the photo or the confirmation', () => {
    writeDraft('user-1', {
      firstName: 'Ada',
      phone: '6095550134',
      photoKey: 'users/user-1/photo.jpg',
      confirmed: true,
    })

    expect(readDraft('user-1')).toEqual({ firstName: 'Ada', phone: '6095550134' })
  })

  it('keeps one account’s draft away from another', () => {
    writeDraft('user-1', { firstName: 'Ada' })

    expect(readDraft('user-2')).toEqual({})
  })

  it('ignores a corrupted or foreign value instead of throwing', () => {
    window.localStorage.setItem(draftKey('user-1'), '{not json')
    expect(readDraft('user-1')).toEqual({})

    window.localStorage.setItem(
      draftKey('user-1'),
      JSON.stringify({ firstName: 42, lastName: 'L' }),
    )
    expect(readDraft('user-1')).toEqual({ lastName: 'L' })
  })

  it('survives storage that refuses to be touched', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => writeDraft('user-1', { firstName: 'Ada' })).not.toThrow()
    expect(readDraft('user-1')).toEqual({})
  })

  it('forgets the draft once cleared', () => {
    writeDraft('user-1', { firstName: 'Ada' })
    clearDraft('user-1')

    expect(readDraft('user-1')).toEqual({})
  })
})
