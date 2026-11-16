import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import {
  CHECK_ROUNDS,
  CHECK_ROUND_LABELS,
  CHECK_STATUS_LABELS,
  MANUAL_RESULT_LABELS,
  type CheckStatus,
  type ManualResult,
} from '../schema'
import {
  ROUND_HEADINGS,
  type DayReport,
  type ReportExpiry,
  type ReportRound,
  type ReportSite,
} from './day-report'
import { EXPIRY_WARNING_DAYS } from './domain'
import { SLOW_RESPONSE_MS } from './verdict'

// US Letter, matching the Word version of the report.
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 36
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_SPACE = 22
const CELL_PADDING = 3.5
const TABLE_SIZE = 8
const LINE_GAP = 2

function hex(value: string): RGB {
  const number = Number.parseInt(value, 16)
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255)
}

const COLORS = {
  navy: hex('003A9E'),
  ink: hex('232323'),
  muted: hex('5A5A5A'),
  border: hex('CFE4F7'),
  zebra: hex('ECF3FF'),
  white: hex('FFFFFF'),
}

// Each holds at least 4.5:1 on both white and the zebra fill, and the word is always printed too.
const STATUS_COLORS: Record<CheckStatus, RGB> = {
  up: hex('0B6B42'),
  issue: hex('7A4F00'),
  down: hex('A61B1B'),
}

interface Run {
  text: string
  bold?: boolean
  color?: RGB
}

type Cell = Run[]

interface Column {
  header: string
  width: number
}

interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

// The standard fonts only carry WinAnsi, so anything else (emoji, CJK) prints as "?" instead of throwing.
function printable(text: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet())
  return [...text.replace(/\t/g, ' ')]
    .map((char) => (char === '\n' || supported.has(char.codePointAt(0) ?? 0) ? char : '?'))
    .join('')
}

export function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of printable(text, font).split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      // A word wider than the column (a long URL) is broken by character.
      let rest = word
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    lines.push(line)
  }
  return lines
}

class Writer {
  readonly pages: PDFPage[] = []
  private page!: PDFPage
  y = 0

  constructor(
    private readonly document: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.addPage()
  }

  addPage() {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.pages.push(this.page)
    this.y = PAGE_HEIGHT - MARGIN
  }

  room() {
    return this.y - (MARGIN + FOOTER_SPACE)
  }

  ensure(height: number) {
    if (height > this.room()) this.addPage()
  }

  text(value: string, options: { size: number; bold?: boolean; color?: RGB; gapAfter?: number }) {
    const font = options.bold ? this.fonts.bold : this.fonts.regular
    const lines = wrapText(value, font, options.size, CONTENT_WIDTH)
    // A short paragraph moves whole to the next page rather than leaving one line behind.
    if (lines.length <= 4) this.ensure(lines.length * (options.size + LINE_GAP))
    for (const line of lines) {
      this.ensure(options.size + LINE_GAP)
      this.y -= options.size
      this.page.drawText(line, {
        x: MARGIN,
        y: this.y,
        size: options.size,
        font,
        color: options.color ?? COLORS.ink,
      })
      this.y -= LINE_GAP
    }
    this.y -= options.gapAfter ?? 0
  }

  heading(value: string) {
    // Kept with at least a header row and one line under it, so a heading never ends a page.
    this.ensure(12 + 60)
    this.y -= 8
    this.text(value, { size: 12, bold: true, color: COLORS.navy, gapAfter: 4 })
  }

  private cellLines(cell: Cell, width: number) {
    return cell.flatMap((run) =>
      wrapText(run.text, run.bold ? this.fonts.bold : this.fonts.regular, TABLE_SIZE, width).map(
        (line) => ({ ...run, text: line }),
      ),
    )
  }

  private drawRow(columns: Column[], cells: Cell[], fill: RGB, header: boolean) {
    const lines = columns.map((column, index) =>
      this.cellLines(cells[index] ?? [], column.width - CELL_PADDING * 2),
    )
    const tallest = Math.max(1, ...lines.map((cell) => cell.length))
    const height = tallest * (TABLE_SIZE + LINE_GAP) + CELL_PADDING * 2
    const top = this.y

    let x = MARGIN
    columns.forEach((column, index) => {
      this.page.drawRectangle({
        x,
        y: top - height,
        width: column.width,
        height,
        color: fill,
        borderColor: COLORS.border,
        borderWidth: 0.6,
      })
      let lineY = top - CELL_PADDING - TABLE_SIZE
      for (const line of lines[index] ?? []) {
        this.page.drawText(line.text, {
          x: x + CELL_PADDING,
          y: lineY + 1.5,
          size: TABLE_SIZE,
          font: line.bold || header ? this.fonts.bold : this.fonts.regular,
          color: header ? COLORS.white : (line.color ?? COLORS.ink),
        })
        lineY -= TABLE_SIZE + LINE_GAP
      }
      x += column.width
    })
    this.y = top - height
  }

  private rowHeight(columns: Column[], cells: Cell[]) {
    const tallest = Math.max(
      1,
      ...columns.map(
        (column, index) =>
          this.cellLines(cells[index] ?? [], column.width - CELL_PADDING * 2).length,
      ),
    )
    return tallest * (TABLE_SIZE + LINE_GAP) + CELL_PADDING * 2
  }

  table(columns: Column[], rows: Cell[][]) {
    const header = columns.map((column) => [{ text: column.header }])
    const headerHeight = this.rowHeight(columns, header)
    this.ensure(headerHeight + (rows[0] ? this.rowHeight(columns, rows[0]) : 0))
    this.drawRow(columns, header, COLORS.navy, true)

    rows.forEach((row, index) => {
      const height = this.rowHeight(columns, row)
      // A row that will not fit starts the next page under a repeated header.
      if (height > this.room()) {
        this.addPage()
        this.drawRow(columns, header, COLORS.navy, true)
      }
      this.drawRow(columns, row, index % 2 === 1 ? COLORS.zebra : COLORS.white, false)
    })
    this.y -= 6
  }
}

function plain(text: string): Cell {
  return [{ text }]
}

function statusRun(status: CheckStatus): Run {
  return { text: CHECK_STATUS_LABELS[status], bold: true, color: STATUS_COLORS[status] }
}

function roundCell(round: ReportRound | undefined): Cell {
  if (!round) return [{ text: 'Not checked', color: COLORS.muted }]
  return [
    { ...statusRun(round.status), text: `${CHECK_STATUS_LABELS[round.status]} · ${round.time}` },
    { text: round.reading, color: COLORS.muted },
    ...(round.overridden ? [{ text: `Set by ${round.checkedBy}`, color: COLORS.muted }] : []),
  ]
}

function manualRun(label: string, result: ManualResult | undefined, when = ''): Run {
  if (!result) return { text: `${label}: not checked`, color: COLORS.muted }
  const text = `${label}: ${MANUAL_RESULT_LABELS[result]}${when ? ` · ${when}` : ''}`
  return result === 'fail' ? { text, bold: true, color: STATUS_COLORS.down } : { text }
}

function yourChecksCell(site: ReportSite): Cell {
  return [
    manualRun('Pages', site.pagesButtons),
    manualRun('Email', site.formEmail?.result, site.formEmail?.testedOn),
  ]
}

function findingsCell(site: ReportSite): Cell {
  const runs: Run[] = []
  if (site.findings) runs.push({ text: `Found: ${site.findings}` })
  if (site.action) runs.push({ text: `Did: ${site.action}` })
  for (const round of CHECK_ROUNDS) {
    const note = site.rounds[round]?.note
    if (note) runs.push({ text: `${CHECK_ROUND_LABELS[round]}: ${note}` })
  }
  return runs.length > 0 ? runs : [{ text: '—', color: COLORS.muted }]
}

function expiryCell(expiry: ReportExpiry): Cell {
  if (!expiry.at || expiry.days === undefined)
    return [{ text: 'Not available', color: COLORS.muted }]
  const left = expiry.days < 0 ? 'expired' : `${expiry.days} days left`
  const soon = expiry.days <= EXPIRY_WARNING_DAYS
  return [
    soon
      ? { text: `${expiry.at} · ${left}`, bold: true, color: STATUS_COLORS.down }
      : { text: `${expiry.at} · ${left}` },
  ]
}

function problemsLine(report: DayReport) {
  if (report.problems.length === 0) return 'No problems this shift.'
  const names = report.problems
    .map((problem) => `${problem.website} (${problem.fixed ? 'fixed' : 'still open'})`)
    .join(', ')
  const count = report.problems.length
  return `${count} ${count === 1 ? 'site' : 'sites'} had problems: ${names}.`
}

/** The report as a plain Letter PDF; the letterhead is stamped on afterwards. */
export async function dayReportPdf(report: DayReport): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(`Daily Website Check Report — ${report.dateLabel}`)
  document.setSubject('Daily website check report')
  document.setCreator('IHP Plus website checker')
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  }
  const writer = new Writer(document, fonts)

  writer.text('Daily Website Check Report', {
    size: 20,
    bold: true,
    color: COLORS.navy,
    gapAfter: 4,
  })
  writer.text(`Night shift · ${report.shiftHours} · ${report.zoneLabel}`, {
    size: 10,
    color: COLORS.muted,
    gapAfter: 10,
  })

  writer.table(
    [
      { header: 'Shift start', width: 104 },
      { header: 'Shift end', width: 104 },
      { header: 'IT lead', width: 104 },
      { header: 'Time in check', width: 96 },
      { header: 'Time out check', width: 96 },
    ],
    [
      [
        plain(report.shiftStart),
        plain(report.shiftEnd),
        plain(report.itLead),
        plain(report.roundTimes.clock_in),
        plain(report.roundTimes.clock_out),
      ],
    ],
  )
  writer.text(
    `Source: IHP Plus website checker · Generated ${report.generatedAt} by ${report.preparedBy}`,
    { size: 8, color: COLORS.muted },
  )

  writer.heading('Portal summary')
  writer.table(
    [
      { header: 'Check', width: 144 },
      { header: 'Running', width: 90 },
      { header: 'With issues', width: 90 },
      { header: 'Down', width: 90 },
      { header: 'Not checked', width: 90 },
    ],
    CHECK_ROUNDS.map((round) => {
      const counts = report.summary[round]
      return [
        plain(ROUND_HEADINGS[round]),
        plain(String(counts.up)),
        plain(String(counts.issue)),
        plain(String(counts.down)),
        plain(String(counts.unchecked)),
      ]
    }),
  )
  const { manual } = report
  writer.text(
    `Your checks: pages and buttons ${manual.pagesPass} pass, ${manual.pagesFail} fail, ${manual.pagesUnchecked} not checked · form email tested on ${manual.formTested} of ${report.sites.length} sites${manual.formFailed > 0 ? `, ${manual.formFailed} failing` : ''}.`,
    { size: 9.5 },
  )
  writer.text(problemsLine(report), {
    size: 9.5,
    bold: report.problems.some((problem) => !problem.fixed),
  })

  writer.heading('Site checks')
  if (report.sites.length === 0) {
    writer.text('No websites were on the list for this shift.', { size: 9.5, color: COLORS.muted })
  } else {
    writer.table(
      [
        { header: 'Website', width: 118 },
        { header: 'Time in', width: 86 },
        { header: 'Time out', width: 86 },
        { header: 'Your checks', width: 92 },
        { header: 'Findings and action', width: 122 },
      ],
      report.sites.map((site) => [
        [
          { text: site.name, bold: true },
          {
            text: site.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
            color: COLORS.muted,
          },
          ...(site.client ? [{ text: `Client: ${site.client}`, color: COLORS.muted }] : []),
        ],
        roundCell(site.rounds.clock_in),
        roundCell(site.rounds.clock_out),
        yourChecksCell(site),
        findingsCell(site),
      ]),
    )
    writer.text(
      `Time in and time out are automatic (slower than ${SLOW_RESPONSE_MS.toLocaleString('en-US')} ms is Issue). "Set by" marks a status the IT lead changed by hand.`,
      { size: 8, color: COLORS.muted },
    )
  }

  if (report.hasExpiry && report.sites.length > 0) {
    writer.heading('Domains and SSL')
    writer.table(
      [
        { header: 'Website', width: 168 },
        { header: 'Domain expires', width: 168 },
        { header: 'SSL certificate expires', width: 168 },
      ],
      report.sites.map((site) => [plain(site.name), expiryCell(site.domain), expiryCell(site.ssl)]),
    )
    writer.text(
      `Dates read from the domain registry and the site itself when this report was made; anything within ${EXPIRY_WARNING_DAYS} days is in red.`,
      { size: 8, color: COLORS.muted },
    )
  }

  writer.heading('Sign-off')
  writer.table(
    [
      { header: 'Role', width: 168 },
      { header: 'Name', width: 168 },
      { header: 'Date and time', width: 168 },
    ],
    [[plain('Checked by'), plain(report.preparedBy), plain(report.generatedAt)]],
  )

  const total = writer.pages.length
  writer.pages.forEach((page, index) => {
    const label = `Daily Website Check Report · ${report.dateLabel} · Page ${index + 1} of ${total}`
    page.drawText(label, {
      x: MARGIN,
      y: MARGIN,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    })
  })

  return document.save()
}
