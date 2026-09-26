import { describe, expect, it } from 'vitest'
import type { AttendanceDayRow, BillingStatementValues } from '../schema'
import { billingStatementSchema } from '../schema'
import { billingStatementHtml, statementTotals, timeWorked } from './billing-statement'

function day(workDate: string, workedSeconds: number): AttendanceDayRow {
  return { workDate, workedSeconds } as AttendanceDayRow
}

const VALUES: BillingStatementValues = {
  contractorName: 'Dana Reyes',
  position: 'Virtual assistant',
  invoiceNumber: 'INV-20260930',
  invoiceDate: '2026-09-30',
  daysWorked: 20,
  hoursWorked: 160,
  dailyRateCents: 4_500,
  bonusCents: 5_000,
  expenses: [{ description: 'Internet', amountCents: 2_500 }],
  wiseLink: 'https://wise.com/pay/r/abc',
}

describe('timeWorked', () => {
  it('counts each dated day once and skips days with no time', () => {
    expect(
      timeWorked([day('2026-09-01', 4 * 3600), day('2026-09-01', 4 * 3600), day('2026-09-02', 0)]),
    ).toEqual({ daysWorked: 1, hoursWorked: 8 })
  })

  it('rounds hours to two decimals', () => {
    expect(timeWorked([day('2026-09-01', 1000)]).hoursWorked).toBe(0.28)
  })
})

describe('statementTotals', () => {
  it('adds days × rate, the bonus and every expense', () => {
    expect(statementTotals(VALUES)).toEqual({
      regularCents: 90_000,
      expensesCents: 2_500,
      totalCents: 97_500,
    })
  })
})

describe('billingStatementSchema', () => {
  it('asks for a daily rate and an https Wise link', () => {
    const result = billingStatementSchema.safeParse({
      ...VALUES,
      dailyRateCents: 0,
      wiseLink: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((issue) => issue.message)
    expect(messages).toContain('Enter your daily rate.')
    expect(messages).toContain('Paste your Wise payment link, starting with https://.')
  })
})

describe('billingStatementHtml', () => {
  it('lays out the template with the period, totals and payment reference', () => {
    const html = billingStatementHtml(VALUES, { from: '2026-09-01', to: '2026-09-30' })

    expect(html).toContain('September 1, 2026 – September 30, 2026')
    expect(html).toContain('Innovare HP')
    expect(html).toContain('$900.00')
    expect(html).toContain('$975.00 USD')
    expect(html).toContain('Internet')
    expect(html).toContain('<dt>Payment Reference:</dt><dd>INV-20260930</dd>')
  })

  it('escapes what the contractor typed', () => {
    const html = billingStatementHtml(
      { ...VALUES, contractorName: '<script>x</script>' },
      { from: '2026-09-01', to: '2026-09-30' },
    )
    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})
