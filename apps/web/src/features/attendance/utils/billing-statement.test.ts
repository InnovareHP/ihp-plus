import { describe, expect, it } from 'vitest'
import type { AttendanceAbsenceRow, AttendanceDayRow, BillingStatementValues } from '../schema'
import { billingStatementSchema } from '../schema'
import {
  billingStatementHtml,
  loadStatementLetterhead,
  statementFileName,
  statementTotals,
  timeWorked,
} from './billing-statement'

function day(workDate: string, workedSeconds: number): AttendanceDayRow {
  return { workDate, workedSeconds } as AttendanceDayRow
}

const VALUES: BillingStatementValues = {
  contractorName: 'Dana Reyes',
  position: 'Virtual assistant',
  fixedPay: false,
  invoiceNumber: 'INV-20260930',
  invoiceDate: '2026-09-30',
  daysWorked: 20,
  hoursWorked: 160,
  hourlyRateCents: 4_500,
  bonusCents: 5_000,
  expenses: [{ description: 'Internet', amountCents: 2_500 }],
  wiseLink: 'https://wise.com/pay/r/abc',
  sendTo: 'payroll@ihp.test',
}

describe('timeWorked', () => {
  it('counts each dated day once and skips days with no time', () => {
    expect(
      timeWorked([day('2026-09-01', 4 * 3600), day('2026-09-01', 4 * 3600), day('2026-09-02', 0)]),
    ).toEqual({ daysWorked: 1, hoursWorked: 8, paidDaysOff: 0 })
  })

  it('bills a paid day off as a day, but not an unpaid one or an absence', () => {
    const off = (workDate: string, paid: boolean, kind: 'leave' | 'absent' = 'leave') =>
      ({ workDate, kind, paid }) as AttendanceAbsenceRow

    expect(
      timeWorked(
        [day('2026-09-01', 8 * 3600)],
        [off('2026-09-02', true), off('2026-09-03', false), off('2026-09-04', false, 'absent')],
      ),
    ).toEqual({ daysWorked: 2, hoursWorked: 8, paidDaysOff: 1 })
  })

  it('rounds hours to two decimals', () => {
    expect(timeWorked([day('2026-09-01', 1000)]).hoursWorked).toBe(0.28)
  })
})

describe('statementTotals', () => {
  it('adds hours × rate, the bonus and every expense', () => {
    expect(statementTotals(VALUES)).toEqual({
      regularCents: 720_000,
      expensesCents: 2_500,
      totalCents: 727_500,
    })
  })

  it('bills a fixed rate once, whatever the hours', () => {
    expect(statementTotals({ ...VALUES, fixedPay: true, hourlyRateCents: 150_000 })).toEqual({
      regularCents: 150_000,
      expensesCents: 2_500,
      totalCents: 157_500,
    })
  })
})

describe('billingStatementSchema', () => {
  it('asks for a rate and an https Wise link', () => {
    const result = billingStatementSchema.safeParse({
      ...VALUES,
      hourlyRateCents: 0,
      wiseLink: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((issue) => issue.message)
    expect(messages).toContain('Enter your rate.')
    expect(messages).toContain('Paste your Wise payment link, starting with https://.')
  })

  it('takes a blank recipient, but not a malformed one', () => {
    expect(billingStatementSchema.safeParse({ ...VALUES, sendTo: '  ' }).success).toBe(true)
    const result = billingStatementSchema.safeParse({ ...VALUES, sendTo: 'payroll@' })
    expect(result.error?.issues[0]?.message).toBe('Enter an email address, or leave it blank.')
  })
})

describe('statementFileName', () => {
  it('names the file after the contractor and the invoice', () => {
    expect(statementFileName(VALUES)).toBe('Billing statement - Dana Reyes - INV-20260930')
  })

  it('drops characters a file system refuses', () => {
    expect(statementFileName({ contractorName: 'Dana / Reyes', invoiceNumber: 'INV:9?' })).toBe(
      'Billing statement - Dana - Reyes - INV-9-',
    )
  })

  it('titles the print page with it, which "Save as PDF" suggests as the file name', () => {
    const html = billingStatementHtml(VALUES, { from: '2026-09-01', to: '2026-09-30' })
    expect(html).toContain('<title>Billing statement - Dana Reyes - INV-20260930</title>')
  })
})

describe('billingStatementHtml', () => {
  it('lays out the template with the period, totals and payment reference', () => {
    const html = billingStatementHtml(VALUES, { from: '2026-09-01', to: '2026-09-30' })

    expect(html).toContain('September 1, 2026 – September 30, 2026')
    expect(html).toContain('Innovare HP')
    expect(html).toContain('$7,200.00')
    expect(html).toContain('$7,275.00 USD')
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

  it('prints on the official letterhead, its bands kept clear of the text', async () => {
    const letterhead = await loadStatementLetterhead()
    const html = billingStatementHtml(VALUES, { from: '2026-09-01', to: '2026-09-30' }, letterhead)

    expect(letterhead.header.src).toMatch(/^data:image\/png;base64,iVBOR/)
    expect(html).toContain(`<img class="band band-top" src="${letterhead.header.src}" alt="">`)
    expect(html).toContain(`<img class="band band-bottom" src="${letterhead.footer.src}" alt="">`)
    // 8.5in × 228/1545, the header band's height at the page's width.
    expect(html).toContain('height: calc(1.254in + 0.35in)')
  })

  it('leaves the letterhead off when none is given', () => {
    expect(billingStatementHtml(VALUES, { from: '2026-09-01', to: '2026-09-30' })).not.toContain(
      '<img',
    )
  })
})
