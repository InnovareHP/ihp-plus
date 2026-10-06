import { describe, expect, it } from 'vitest'
import { afterRequest, balanceOf, clipToYear, formatLeaveDays } from './balance'

const BASE = {
  formId: 'form-1',
  formName: 'Vacation leave',
  formAllowance: 15,
  used: 4,
  pending: 2,
}

describe('balanceOf', () => {
  it('takes the form’s allowance unless the person has their own', () => {
    expect(balanceOf({ ...BASE, override: undefined })).toMatchObject({
      allowance: 15,
      remaining: 11,
      overridden: false,
    })
    expect(balanceOf({ ...BASE, override: 20 })).toMatchObject({
      allowance: 20,
      remaining: 16,
      overridden: true,
    })
  })

  it('goes negative when more was approved than allowed', () => {
    expect(balanceOf({ ...BASE, override: 0 }).remaining).toBe(-4)
  })
})

describe('afterRequest', () => {
  it('flags a request that would take the balance below zero', () => {
    const balance = balanceOf({ ...BASE, override: undefined })
    expect(afterRequest(balance, 11)).toEqual({ left: 0, over: false })
    expect(afterRequest(balance, 12)).toEqual({ left: -1, over: true })
  })
})

describe('clipToYear', () => {
  it('keeps the part of a range inside the year', () => {
    expect(clipToYear({ from: '2026-12-28', to: '2027-01-04' }, 2026)).toEqual({
      from: '2026-12-28',
      to: '2026-12-31',
    })
    expect(clipToYear({ from: '2026-12-28', to: '2027-01-04' }, 2027)).toEqual({
      from: '2027-01-01',
      to: '2027-01-04',
    })
    expect(clipToYear({ from: '2026-03-01', to: '2026-03-02' }, 2027)).toBeUndefined()
  })
})

describe('formatLeaveDays', () => {
  it('names one day and many days', () => {
    expect(formatLeaveDays(1)).toBe('1 day')
    expect(formatLeaveDays(-1)).toBe('-1 day')
    expect(formatLeaveDays(3)).toBe('3 days')
  })
})
