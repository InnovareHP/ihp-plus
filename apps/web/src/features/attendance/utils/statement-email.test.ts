import { describe, expect, it } from 'vitest'
import type { BillingStatementValues } from '../schema'
import { statementEmail, statementEml } from './statement-email'

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
const PDF = {
  fileName: 'Billing statement - Dana Reyes - INV-20260930.pdf',
  contentType: 'application/pdf',
  bytes: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]),
}

function decode(base64: string) {
  return Uint8Array.from(atob(base64.replace(/\s/g, '')), (char) => char.charCodeAt(0))
}

/** The base64 body of the MIME part whose headers contain the given text. */
function partBody(eml: string, header: string) {
  const part = eml.split(/\r\n--ihp-[^\r\n]+/).find((one) => one.includes(header)) ?? ''
  return part.split('\r\n\r\n')[1] ?? ''
}

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

describe('statementEml', () => {
  it('is a draft Outlook opens ready to send, addressed and titled', () => {
    const eml = statementEml(statementEmail(VALUES, PERIOD), PDF)

    expect(eml.startsWith('X-Unsent: 1\r\n')).toBe(true)
    expect(eml).toContain('\r\nTo: payroll@ihp.test\r\n')
    // The em dash makes the subject non-ASCII, so it travels encoded.
    expect(eml).toMatch(/\r\nSubject: =\?UTF-8\?B\?/)
  })

  it('carries the PDF as an attachment under its file name, byte for byte', () => {
    const eml = statementEml(statementEmail(VALUES, PERIOD), PDF)

    expect(eml).toContain(
      'Content-Disposition: attachment;\r\n filename="Billing statement - Dana Reyes - INV-20260930.pdf";',
    )
    expect(decode(partBody(eml, 'application/pdf'))).toEqual(PDF.bytes)
  })

  it('keeps the body readable in UTF-8', () => {
    const eml = statementEml(statementEmail(VALUES, PERIOD), PDF)
    const body = new TextDecoder().decode(decode(partBody(eml, 'text/plain')))

    expect(body).toContain('Total due: $7,275.00 USD\r\n')
  })

  it('leaves the recipient for the mail app when none was given', () => {
    const eml = statementEml(statementEmail({ ...VALUES, sendTo: '' }, PERIOD), PDF)

    expect(eml).not.toContain('\r\nTo:')
  })

  it('wraps encoded content at 76 characters and keeps every line within mail’s limit', () => {
    const bytes = new Uint8Array(4_000).map((_, index) => index % 256)
    const eml = statementEml(
      statementEmail({ ...VALUES, contractorName: 'Dana Reyes-Villanueva de los Santos' }, PERIOD),
      { ...PDF, bytes },
    )
    const lines = eml.split('\r\n')

    for (const line of lines) expect(line.length).toBeLessThanOrEqual(998)
    for (const line of partBody(eml, 'application/pdf').split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(76)
    }
    for (const line of lines.filter((one) => one.startsWith('Subject:') || one.startsWith(' =?'))) {
      expect(line.length).toBeLessThanOrEqual(78)
    }
  })
})
