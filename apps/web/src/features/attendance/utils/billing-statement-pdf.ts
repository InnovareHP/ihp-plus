import {
  PDFDocument,
  PDFString,
  rgb,
  StandardFonts,
  type Color,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import { LETTERHEAD_ARTWORK } from '@/features/letterhead/utils/letterhead-artwork'
import type { BillingStatementValues } from '../schema'
import {
  formatStatementDate,
  formatUsd,
  STATEMENT_COMPANY,
  statementFileName,
  statementTotals,
  type StatementPeriod,
} from './billing-statement'

// US Letter in points, the page the letterhead's Word original is set on.
const WIDTH = 612
const HEIGHT = 792
const MARGIN = 72
const GAP = 25
const ROW_HEIGHT = 22
const CELL_PAD = 8
const LINE_HEIGHT = 15
const BODY_SIZE = 10

function colorOf(hex: string) {
  const value = Number.parseInt(hex, 16)
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

const INK = colorOf('222222')
const BRAND = colorOf('1346c5')
const NAVY = colorOf('0b286b')
const TINT = colorOf('dce7ff')
const WHITE = rgb(1, 1, 1)

/** Standard fonts only speak WinAnsi; anything else would throw mid-draw. */
function printable(font: PDFFont, text: string) {
  const known = new Set(font.getCharacterSet())
  return [...text].filter((char) => known.has(char.codePointAt(0) ?? 0)).join('')
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number) {
  let fitted = printable(font, text)
  while (fitted.length > 1 && font.widthOfTextAtSize(fitted, size) > maxWidth) {
    fitted = `${fitted.slice(0, -2).trimEnd()}…`
  }
  return fitted
}

// A payment link has no spaces to break on, so it wraps wherever the line runs out.
function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  for (const char of printable(font, text)) {
    if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) {
      lines.push(line)
      line = ''
    }
    line += char
  }
  return line ? [...lines, line] : lines
}

function addLink(page: PDFPage, rect: [number, number, number, number], url: string) {
  const { context } = page.doc
  const annotation = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: rect,
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    }),
  )
  page.node.addAnnot(annotation)
}

interface Detail {
  label: string
  value: string
  href?: string
}

interface TableRow {
  label: string
  value: string
}

interface Kit {
  regular: PDFFont
  bold: PDFFont
  header: PDFImage
  footer: PDFImage
}

/** Draws top to bottom, starting a fresh letterhead page whenever the next block would not fit. */
function writer(document: PDFDocument, kit: Kit) {
  const headerHeight = (WIDTH * LETTERHEAD_ARTWORK.header.height) / LETTERHEAD_ARTWORK.header.width
  const footerHeight = (WIDTH * LETTERHEAD_ARTWORK.footer.height) / LETTERHEAD_ARTWORK.footer.width
  const top = HEIGHT - headerHeight - GAP
  const bottom = footerHeight + GAP
  const contentWidth = WIDTH - 2 * MARGIN

  function addPage() {
    const next = document.addPage([WIDTH, HEIGHT])
    next.drawImage(kit.header, {
      x: 0,
      y: HEIGHT - headerHeight,
      width: WIDTH,
      height: headerHeight,
    })
    next.drawImage(kit.footer, { x: 0, y: 0, width: WIDTH, height: footerHeight })
    return next
  }

  let page = addPage()
  let y = top

  function room(height: number) {
    if (y - height >= bottom) return
    page = addPage()
    y = top
  }

  function heading(title: string, size: number, color: Color, spaceBefore: number) {
    room(spaceBefore + size + 8 + ROW_HEIGHT)
    y -= spaceBefore + size
    page.drawText(printable(kit.bold, title), { x: MARGIN, y, size, font: kit.bold, color })
    y -= 8
  }

  function details(rows: readonly Detail[]) {
    const labelWidth =
      Math.max(...rows.map((row) => kit.bold.widthOfTextAtSize(row.label, BODY_SIZE))) + 16
    const valueX = MARGIN + labelWidth
    const valueWidth = contentWidth - labelWidth

    for (const row of rows) {
      const lines = row.href
        ? wrap(kit.regular, row.value, BODY_SIZE, valueWidth)
        : [fit(kit.regular, row.value, BODY_SIZE, valueWidth)]
      room(LINE_HEIGHT * lines.length)
      page.drawText(printable(kit.bold, row.label), {
        x: MARGIN,
        y: y - BODY_SIZE,
        size: BODY_SIZE,
        font: kit.bold,
        color: INK,
      })
      for (const line of lines) {
        y -= LINE_HEIGHT
        const baseline = y + LINE_HEIGHT - BODY_SIZE
        page.drawText(line, {
          x: valueX,
          y: baseline,
          size: BODY_SIZE,
          font: kit.regular,
          color: row.href ? BRAND : INK,
        })
        if (row.href) {
          const width = kit.regular.widthOfTextAtSize(line, BODY_SIZE)
          addLink(page, [valueX, baseline - 3, valueX + width, baseline + BODY_SIZE], row.href)
        }
      }
    }
  }

  function tableRow(
    row: TableRow,
    style: { fill?: Color; font: PDFFont; color: Color; size: number },
  ) {
    room(ROW_HEIGHT)
    y -= ROW_HEIGHT
    if (style.fill) {
      page.drawRectangle({
        x: MARGIN,
        y,
        width: contentWidth,
        height: ROW_HEIGHT,
        color: style.fill,
      })
    } else {
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: WIDTH - MARGIN, y },
        thickness: 1,
        color: TINT,
      })
    }
    const baseline = y + (ROW_HEIGHT - style.size) / 2 + 2
    const value = fit(style.font, row.value, style.size, contentWidth / 2 - CELL_PAD)
    const valueWidth = style.font.widthOfTextAtSize(value, style.size)
    page.drawText(fit(style.font, row.label, style.size, contentWidth / 2 - CELL_PAD * 2), {
      x: MARGIN + CELL_PAD,
      y: baseline,
      size: style.size,
      font: style.font,
      color: style.color,
    })
    page.drawText(value, {
      x: WIDTH - MARGIN - CELL_PAD - valueWidth,
      y: baseline,
      size: style.size,
      font: style.font,
      color: style.color,
    })
  }

  function table(header: TableRow, rows: readonly TableRow[], total?: TableRow) {
    tableRow(header, { fill: TINT, font: kit.bold, color: NAVY, size: BODY_SIZE })
    for (const row of rows) {
      tableRow(row, { font: kit.regular, color: INK, size: BODY_SIZE })
    }
    if (total) tableRow(total, { fill: BRAND, font: kit.bold, color: WHITE, size: 11.5 })
  }

  return { heading, details, table }
}

/** The printed statement as a real PDF on the letterhead, for downloading and attaching to mail. */
export async function billingStatementPdf(
  values: BillingStatementValues,
  period: StatementPeriod,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(statementFileName(values))
  document.setAuthor(values.contractorName)
  document.setSubject(`Billing statement ${values.invoiceNumber}`)
  document.setCreator(STATEMENT_COMPANY)

  const kit: Kit = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    header: await document.embedPng(LETTERHEAD_ARTWORK.header.base64),
    footer: await document.embedPng(LETTERHEAD_ARTWORK.footer.base64),
  }
  const draw = writer(document, kit)
  const totals = statementTotals(values)

  draw.heading('BILLING STATEMENT', 20, BRAND, 0)
  draw.details([
    { label: 'Contractor:', value: values.contractorName },
    { label: 'Position / Role:', value: values.position || '—' },
    { label: 'Company:', value: STATEMENT_COMPANY },
    {
      label: 'Billing Period:',
      value: `${formatStatementDate(period.from)} – ${formatStatementDate(period.to)}`,
    },
    { label: 'Invoice Date:', value: formatStatementDate(values.invoiceDate) },
  ])

  draw.heading('WORK SUMMARY', 12, NAVY, 22)
  draw.table({ label: 'Description', value: 'Details' }, [
    {
      label: 'Days Worked',
      value: `${values.daysWorked} ${values.daysWorked === 1 ? 'day' : 'days'}`,
    },
    { label: 'Total Hours Worked', value: `${values.hoursWorked.toFixed(2)} hours` },
    {
      label: values.fixedPay ? 'Fixed Rate (per statement)' : 'Hourly Rate',
      value: formatUsd(values.hourlyRateCents),
    },
    { label: 'Regular Compensation', value: formatUsd(totals.regularCents) },
  ])

  draw.heading('COMPENSATION', 12, NAVY, 22)
  draw.table(
    { label: 'Description', value: 'Amount' },
    [
      { label: 'Regular Compensation', value: formatUsd(totals.regularCents) },
      { label: 'Bonus', value: formatUsd(values.bonusCents) },
      ...values.expenses.map((expense) => ({
        label: expense.description,
        value: formatUsd(expense.amountCents),
      })),
    ],
    { label: 'TOTAL AMOUNT DUE', value: `${formatUsd(totals.totalCents)} USD` },
  )

  draw.heading('PAYMENT DETAILS', 12, NAVY, 22)
  draw.details([
    { label: 'Payment Method:', value: 'Wise' },
    { label: 'Payment Link:', value: values.wiseLink, href: values.wiseLink },
    { label: 'Payment Currency:', value: 'USD' },
    { label: 'Payment Reference:', value: values.invoiceNumber },
  ])

  return document.save()
}
