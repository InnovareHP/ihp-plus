import { PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { BillingStatementValues } from '../schema'
import { billingStatementPdf } from './billing-statement-pdf'

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

function linksOf(document: PDFDocument) {
  return document.getPages().flatMap((page) => {
    const annotations = page.node.Annots()
    if (!annotations) return []
    return annotations.asArray().flatMap((ref) => {
      const action = document.context.lookup(ref, PDFDict).lookupMaybe(PDFName.of('A'), PDFDict)
      const uri = action?.lookupMaybe(PDFName.of('URI'), PDFString)
      return uri ? [uri.decodeText()] : []
    })
  })
}

describe('billingStatementPdf', () => {
  it('builds one letterhead page titled with the statement’s file name', async () => {
    const document = await PDFDocument.load(await billingStatementPdf(VALUES, PERIOD))

    expect(document.getPageCount()).toBe(1)
    expect(document.getTitle()).toBe('Billing statement - Dana Reyes - INV-20260930')
    expect(document.getAuthor()).toBe('Dana Reyes')
  })

  it('makes the Wise link clickable', async () => {
    const document = await PDFDocument.load(await billingStatementPdf(VALUES, PERIOD))

    expect(linksOf(document)).toEqual(['https://wise.com/pay/r/abc'])
  })

  it('runs onto a second page rather than into the footer', async () => {
    const expenses = Array.from({ length: 20 }, (_, index) => ({
      description: `Expense ${index + 1}`,
      amountCents: 1_000,
    }))
    const document = await PDFDocument.load(
      await billingStatementPdf({ ...VALUES, expenses }, PERIOD),
    )

    expect(document.getPageCount()).toBe(2)
  })

  it('skips characters the standard fonts cannot draw instead of failing', async () => {
    const bytes = await billingStatementPdf(
      { ...VALUES, contractorName: 'Đặng 陈', position: 'Asistente 🙂' },
      PERIOD,
    )
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})
