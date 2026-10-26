import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { draftPdf } from './draft-pdf'
import { CONTRACT_TEMPLATE } from './templates'

describe('draftPdf', () => {
  it('renders a template on letterhead pages with the draft title', async () => {
    const pdf = await PDFDocument.load(await draftPdf('Services agreement', CONTRACT_TEMPLATE.body))
    expect(pdf.getTitle()).toBe('Services agreement')
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('flows a long document onto more pages', async () => {
    const long = Array.from({ length: 120 }, (_, index) => `Paragraph ${index} of the terms.`).join(
      '\n\n',
    )
    const pdf = await PDFDocument.load(await draftPdf('Long', `# Long\n\n${long}`))
    expect(pdf.getPageCount()).toBeGreaterThan(1)
  })
})
