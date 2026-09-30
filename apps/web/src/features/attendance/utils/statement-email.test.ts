import { describe, expect, it } from 'vitest'
import type { BillingStatementValues } from '../schema'
import { statementEmail, statementMailto } from './statement-email'

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

const PERIOD = { from: '2026-09-01', to: '2026-09-30' }

describe('statementEmail', () => {
  it('writes the subject and body from the statement', () => {
    const email = statementEmail(VALUES, PERIOD)

    expect(email.to).toBe('payroll@ihp.test')
    expect(email.subject).toBe('Billing statement INV-20260930 — Dana Reyes')
    expect(email.body).toContain('September 1, 2026 – September 30, 2026')
    expect(email.body).toContain('Total due: $7,275.00 USD')
    expect(email.body).toContain('Pay via Wise: https://wise.com/pay/r/abc')
    expect(email.body.endsWith('Thanks,\nDana Reyes')).toBe(true)
  })
})

describe('statementMailto', () => {
  it('addresses the mail app’s new message and fills its subject and body', () => {
    const url = new URL(statementMailto(statementEmail(VALUES, PERIOD)))

    expect(url.protocol).toBe('mailto:')
    expect(decodeURIComponent(url.pathname)).toBe('payroll@ihp.test')
    expect(url.searchParams.get('subject')).toBe('Billing statement INV-20260930 — Dana Reyes')
    expect(url.searchParams.get('body')).toContain('Total due: $7,275.00 USD\r\n')
  })

  it('encodes spaces as %20, since some mail apps show a + literally', () => {
    const url = statementMailto(statementEmail(VALUES, PERIOD))

    expect(url).toContain('subject=Billing%20statement%20INV-20260930')
    expect(url).not.toContain('+')
  })

  it('leaves the recipient for the mail app when none was given', () => {
    expect(statementMailto(statementEmail({ ...VALUES, sendTo: '' }, PERIOD))).toMatch(
      /^mailto:\?subject=/,
    )
  })
})
