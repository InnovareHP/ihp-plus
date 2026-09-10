import { describe, expect, it } from 'vitest'
import { pageInfoOf, pageRangeOf, paginationSchema, skipTake } from './pagination'

describe('paginationSchema', () => {
  it('reads the numbers a URL carries as strings', () => {
    expect(paginationSchema.parse({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10 })
  })

  it('falls back instead of throwing on a hand-edited URL', () => {
    expect(paginationSchema.parse({ page: 'x', pageSize: '-4' })).toEqual({ page: 1, pageSize: 25 })
  })

  it('caps the page size so one request cannot read the whole table', () => {
    expect(paginationSchema.parse({ pageSize: '100000' }).pageSize).toBe(25)
  })
})

describe('pageInfoOf', () => {
  it('reports the page count and the neighbours', () => {
    expect(pageInfoOf({ page: 2, pageSize: 25, total: 214 })).toEqual({
      page: 2,
      pageSize: 25,
      total: 214,
      pageCount: 9,
      hasPrevious: true,
      hasNext: true,
    })
  })

  it('clamps a page past the end onto the last one', () => {
    expect(pageInfoOf({ page: 99, pageSize: 25, total: 30 })).toMatchObject({
      page: 2,
      pageCount: 2,
      hasNext: false,
    })
  })

  it('stays on page 1 of 1 when nothing matches', () => {
    expect(pageInfoOf({ page: 4, pageSize: 25, total: 0 })).toMatchObject({
      page: 1,
      pageCount: 1,
      hasPrevious: false,
      hasNext: false,
    })
  })
})

describe('skipTake', () => {
  it('offsets by the clamped page, not the requested one', () => {
    expect(skipTake(pageInfoOf({ page: 99, pageSize: 10, total: 25 }))).toEqual({
      skip: 20,
      take: 10,
    })
  })
})

describe('pageRangeOf', () => {
  it('describes the rows on this page', () => {
    expect(pageRangeOf(pageInfoOf({ page: 2, pageSize: 25, total: 214 }))).toEqual({
      from: 26,
      to: 50,
    })
  })

  it('stops at the total on the last page', () => {
    expect(pageRangeOf(pageInfoOf({ page: 3, pageSize: 25, total: 52 }))).toEqual({
      from: 51,
      to: 52,
    })
  })

  it('reads 0–0 with no rows at all', () => {
    expect(pageRangeOf(pageInfoOf({ page: 1, pageSize: 25, total: 0 }))).toEqual({ from: 0, to: 0 })
  })
})
