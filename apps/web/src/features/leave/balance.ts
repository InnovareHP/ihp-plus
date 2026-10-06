import type { LeaveBalance } from './schema'

export interface DateRange {
  from: string
  to: string
}

export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** The part of a range inside one calendar year, or undefined when none of it is. */
export function clipToYear(range: DateRange, year: number): DateRange | undefined {
  const bounds = yearRange(year)
  const from = range.from > bounds.from ? range.from : bounds.from
  const to = range.to < bounds.to ? range.to : bounds.to
  return from <= to ? { from, to } : undefined
}

export function balanceOf(input: {
  formId: string
  formName: string
  formAllowance: number
  override: number | undefined
  used: number
  pending: number
}): LeaveBalance {
  const allowance = input.override ?? input.formAllowance
  return {
    formId: input.formId,
    formName: input.formName,
    allowance,
    used: input.used,
    pending: input.pending,
    remaining: allowance - input.used,
    overridden: input.override !== undefined,
  }
}

/** What approving `days` more would leave, and whether that dips below zero. */
export function afterRequest(balance: LeaveBalance, days: number) {
  const left = balance.remaining - days
  return { left, over: left < 0 }
}

export function formatLeaveDays(days: number) {
  return Math.abs(days) === 1 ? `${days} day` : `${days} days`
}
