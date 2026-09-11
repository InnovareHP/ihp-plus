import { describe, expect, it } from 'vitest'
import { clientDraftSchema, clientQuerySchema, EMPTY_CLIENT_DRAFT } from './schema'

const draft = (patch: Record<string, unknown> = {}) =>
  clientDraftSchema.safeParse({ ...EMPTY_CLIENT_DRAFT, name: 'Riverside Care', ...patch })

describe('clientDraftSchema', () => {
  it('needs a name of at least two characters', () => {
    expect(draft({ name: 'R' }).error?.issues[0]?.message).toBe('Give the client a name.')
    expect(draft().success).toBe(true)
  })

  it('accepts a blank optional field but not a malformed email', () => {
    expect(draft({ email: '' }).success).toBe(true)
    expect(draft({ email: 'dana@riversidecare.com' }).success).toBe(true)
    expect(draft({ email: 'dana@' }).success).toBe(false)
  })

  it('takes a date-only last contact, or nothing', () => {
    expect(draft({ lastContactAt: '2026-03-04' }).success).toBe(true)
    expect(draft({ lastContactAt: '' }).success).toBe(true)
    expect(draft({ lastContactAt: 'yesterday' }).success).toBe(false)
  })

  it('caps the notes so one row cannot hold a document', () => {
    expect(draft({ notes: 'x'.repeat(2001) }).error?.issues[0]?.message).toBe(
      'Keep notes under 2000 characters.',
    )
  })

  it('trims what it stores', () => {
    expect(draft({ name: '  Riverside Care  ', city: ' Trenton ' }).data).toMatchObject({
      name: 'Riverside Care',
      city: 'Trenton',
    })
  })
})

describe('clientQuerySchema', () => {
  const parse = (raw: Record<string, unknown>) => clientQuerySchema.parse(raw)

  it('lists active clients sorted by name on page one by default', () => {
    expect(parse({})).toMatchObject({
      page: 1,
      pageSize: 25,
      view: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      statuses: [],
      ownerIds: [],
    })
  })

  it('keeps the statuses it knows and drops the rest', () => {
    expect(parse({ statuses: 'active,cancelled,on_hold' }).statuses).toEqual(['active', 'on_hold'])
  })

  it('falls back rather than throwing on a hand-edited URL', () => {
    expect(parse({ view: 'deleted', sortBy: 'revenue', page: 'two' })).toMatchObject({
      view: 'active',
      sortBy: 'name',
      page: 1,
    })
  })
})
