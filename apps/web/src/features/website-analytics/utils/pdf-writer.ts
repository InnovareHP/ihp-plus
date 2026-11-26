import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'

// US Letter; the letterhead is stamped afterwards and shrinks this content to clear its bands.
export const PAGE_WIDTH = 612
export const PAGE_HEIGHT = 792
export const MARGIN = 32
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function hex(value: string): RGB {
  const number = Number.parseInt(value, 16)
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255)
}

// Brand blue and navy from .claude/rules/brand.md; every text colour holds 4.5:1 on white.
export const PDF_COLORS = {
  brand: hex('1346C5'),
  navy: hex('0B286B'),
  ink: hex('222222'),
  muted: hex('4A4A4A'),
  line: hex('C9D6F2'),
  tint: hex('EEF3FF'),
  previous: hex('8A8F98'),
  white: hex('FFFFFF'),
}

export interface Run {
  text: string
  bold?: boolean
  color?: RGB
}

export interface Column<Row> {
  header: string
  value: (row: Row) => string
  /** Share of the table's width. */
  width: number
  numeric?: boolean
}

// The standard fonts only cover WinAnsi, so characters outside it are swapped, never thrown on.
const SWAPS: Record<string, string> = {
  '−': '-',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '→': '->',
  '≤': '<=',
  '≥': '>=',
}

/** A column of the page, for blocks laid out side by side. */
export interface Area {
  left?: number
  span?: number
}

export async function createWriter() {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const supported = new Set(regular.getCharacterSet())

  let page: PDFPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const fontOf = (run: { bold?: boolean }): PDFFont => (run.bold ? bold : regular)

  function clean(text: string): string {
    return [...text]
      .map((char) => SWAPS[char] ?? (supported.has(char.codePointAt(0) ?? 0) ? char : '?'))
      .join('')
  }

  function newPage() {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  /** Starts a new page when fewer than `height` points are left. */
  function ensure(height: number) {
    if (y - height < MARGIN) newPage()
  }

  function widthOf(text: string, size: number, isBold = false) {
    return fontOf({ bold: isBold }).widthOfTextAtSize(clean(text), size)
  }

  /** Breaks runs into lines no wider than `width`, keeping each run's weight and colour. */
  function wrap(runs: Run[], size: number, width: number): Run[][] {
    const lines: Run[][] = [[]]
    let lineWidth = 0
    for (const run of runs) {
      const words = clean(run.text).split(/(\s+)/).filter(Boolean)
      for (const word of words) {
        const wordWidth = fontOf(run).widthOfTextAtSize(word, size)
        const isSpace = /^\s+$/.test(word)
        if (lineWidth + wordWidth > width && lineWidth > 0 && !isSpace) {
          lines.push([])
          lineWidth = 0
        }
        if (isSpace && lineWidth === 0) continue
        lines.at(-1)?.push({ ...run, text: word })
        lineWidth += wordWidth
      }
    }
    return lines.filter((line) => line.length > 0)
  }

  function drawLine(line: Run[], x: number, size: number) {
    let cursor = x
    for (const run of line) {
      page.drawText(run.text, {
        x: cursor,
        y,
        size,
        font: fontOf(run),
        color: run.color ?? PDF_COLORS.ink,
      })
      cursor += fontOf(run).widthOfTextAtSize(run.text, size)
    }
  }

  /** A wrapped paragraph at the cursor; `indent` shifts every line, `marker` hangs before the first. */
  function paragraph(
    runs: Run[],
    {
      size = 10,
      gap = 4,
      indent = 0,
      marker,
      left = MARGIN,
      span = CONTENT_WIDTH,
    }: { size?: number; gap?: number; indent?: number; marker?: string } & Area = {},
  ) {
    const lineHeight = size * 1.35
    const lines = wrap(runs, size, span - indent)
    for (const [index, line] of lines.entries()) {
      ensure(lineHeight)
      y -= size
      if (index === 0 && marker) {
        page.drawText(clean(marker), {
          x: left + indent - 14,
          y,
          size,
          font: regular,
          color: PDF_COLORS.ink,
        })
      }
      drawLine(line, left + indent, size)
      y -= lineHeight - size
    }
    y -= gap
  }

  function heading(
    text: string,
    size = 13,
    { before = 6, gap = 6, ...area }: { before?: number; gap?: number } & Area = {},
  ) {
    ensure(size * 3)
    y -= before
    paragraph([{ text, bold: true, color: PDF_COLORS.navy }], { size, gap, ...area })
  }

  /** A bold caption at the left of a block, which may sit in a column rather than the full width. */
  function caption(text: string, left: number, below = 6) {
    y -= 10
    page.drawText(clean(text), { x: left, y, size: 10, font: bold, color: PDF_COLORS.ink })
    y -= below
  }

  /** A row of equal boxes, each a label, a large value and an optional note line. */
  function tiles(
    items: { label: string; value: string; note?: string }[],
    perRow: number,
    {
      height = 58,
      valueSize = 16,
      noteSize = 7.5,
    }: { height?: number; valueSize?: number; noteSize?: number } = {},
  ) {
    const gap = 8
    const width = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow
    const shift = 58 - height
    for (let start = 0; start < items.length; start += perRow) {
      ensure(height + gap)
      const top = y
      items.slice(start, start + perRow).forEach((item, index) => {
        const x = MARGIN + index * (width + gap)
        page.drawRectangle({
          x,
          y: top - height,
          width,
          height,
          borderColor: PDF_COLORS.line,
          borderWidth: 1,
          color: PDF_COLORS.white,
        })
        const fit = (text: string, size: number, isBold = false) => {
          let shown = clean(text)
          while (shown.length > 1 && widthOf(shown, size, isBold) > width - 14) {
            shown = `${shown.slice(0, -2)}…`.replace('……', '…')
          }
          return clean(shown)
        }
        page.drawText(fit(item.label, 8), {
          x: x + 8,
          y: top - 14,
          size: 8,
          font: regular,
          color: PDF_COLORS.muted,
        })
        page.drawText(fit(item.value, valueSize, true), {
          x: x + 8,
          y: top - 34 + shift / 2,
          size: valueSize,
          font: bold,
          color: PDF_COLORS.ink,
        })
        if (item.note) {
          page.drawText(fit(item.note, noteSize), {
            x: x + 8,
            y: top - 49 + shift,
            size: noteSize,
            font: regular,
            color: PDF_COLORS.muted,
          })
        }
      })
      y = top - height - gap
    }
  }

  /** A plain table with a tinted header row; long first-column text is cut to fit one line. */
  function table<Row>(
    title: string,
    columns: Column<Row>[],
    rows: Row[],
    empty: string,
    { left = MARGIN, span = CONTENT_WIDTH, rowHeight = 16 }: Area & { rowHeight?: number } = {},
  ) {
    const size = 8.5
    ensure(rowHeight * Math.min(rows.length + 2, 5) + 14)
    caption(title, left)
    const total = columns.reduce((sum, column) => sum + column.width, 0)
    const widths = columns.map((column) => (column.width / total) * span)

    const drawRow = (cells: string[], header: boolean, shade: boolean) => {
      ensure(rowHeight)
      if (shade) {
        page.drawRectangle({
          x: left,
          y: y - rowHeight,
          width: span,
          height: rowHeight,
          color: PDF_COLORS.tint,
        })
      }
      let x = left
      cells.forEach((cell, index) => {
        const column = columns[index]
        const width = widths[index] ?? 0
        let shown = clean(cell)
        while (shown.length > 1 && widthOf(shown, size, header) > width - 10) {
          shown = `${shown.slice(0, -2)}…`.replace('……', '…')
        }
        const textWidth = widthOf(shown, size, header)
        page.drawText(clean(shown), {
          x: column?.numeric ? x + width - 5 - textWidth : x + 5,
          y: y - rowHeight + (rowHeight - size) / 2 + 1.5,
          size,
          font: header ? bold : regular,
          color: PDF_COLORS.ink,
        })
        x += width
      })
      y -= rowHeight
    }

    drawRow(
      columns.map((column) => column.header),
      true,
      true,
    )
    if (rows.length === 0) {
      drawRow([empty, ...columns.slice(1).map(() => '')], false, false)
    }
    rows.forEach((row, index) => {
      drawRow(
        columns.map((column) => column.value(row)),
        false,
        index % 2 === 1,
      )
    })
    page.drawLine({
      start: { x: left, y },
      end: { x: left + span, y },
      thickness: 0.75,
      color: PDF_COLORS.line,
    })
    y -= 12
  }

  /** One count per day, the range solid in brand blue and the period before dashed in grey. */
  function lineChart(
    title: string,
    points: { label: string; current: number; previous: number }[],
    {
      height = 150,
      left: areaLeft = MARGIN,
      span = CONTENT_WIDTH,
    }: Area & { height?: number } = {},
  ) {
    ensure(height + 40)
    caption(title, areaLeft, 5.5)

    // Legend, so the two lines are told apart by name as well as by colour and dash.
    const legendY = y - 10
    const legend = (x: number, color: RGB, dashed: boolean, label: string) => {
      page.drawLine({
        start: { x, y: legendY + 3 },
        end: { x: x + 18, y: legendY + 3 },
        thickness: 2,
        color,
        dashArray: dashed ? [3, 2] : undefined,
      })
      page.drawText(label, { x: x + 22, y: legendY, size: 8, font: regular, color: PDF_COLORS.ink })
    }
    legend(areaLeft, PDF_COLORS.brand, false, 'This period')
    legend(areaLeft + 90, PDF_COLORS.previous, true, 'Previous period')
    y -= 18

    const axisWidth = 30
    const left = areaLeft + axisWidth
    const width = span - axisWidth
    const bottom = y - height + 14
    const max = Math.max(1, ...points.flatMap((point) => [point.current, point.previous]))
    const step = Math.max(1, Math.ceil(max / 4))
    const top = step * 4

    for (let tick = 0; tick <= 4; tick += 1) {
      const tickY = bottom + ((height - 24) * tick) / 4
      page.drawLine({
        start: { x: left, y: tickY },
        end: { x: left + width, y: tickY },
        thickness: 0.5,
        color: PDF_COLORS.line,
      })
      const label = String(step * tick)
      page.drawText(label, {
        x: left - 6 - widthOf(label, 7),
        y: tickY - 2.5,
        size: 7,
        font: regular,
        color: PDF_COLORS.muted,
      })
    }

    const xOf = (index: number) =>
      left + (points.length <= 1 ? width / 2 : (width * index) / (points.length - 1))
    const yOf = (value: number) => bottom + ((height - 24) * value) / top
    const draw = (key: 'current' | 'previous', color: RGB, dashed: boolean) => {
      points.forEach((point, index) => {
        const next = points[index + 1]
        if (!next) return
        page.drawLine({
          start: { x: xOf(index), y: yOf(point[key]) },
          end: { x: xOf(index + 1), y: yOf(next[key]) },
          thickness: 1.75,
          color,
          dashArray: dashed ? [3, 2] : undefined,
        })
      })
    }
    draw('previous', PDF_COLORS.previous, true)
    draw('current', PDF_COLORS.brand, false)

    // About six date labels, so they never collide on a long range.
    const every = Math.max(1, Math.ceil(points.length / 6))
    points.forEach((point, index) => {
      if (index % every !== 0 && index !== points.length - 1) return
      const label = clean(point.label)
      const x = Math.min(
        left + width - widthOf(label, 7),
        Math.max(left, xOf(index) - widthOf(label, 7) / 2),
      )
      page.drawText(label, { x, y: bottom - 11, size: 7, font: regular, color: PDF_COLORS.muted })
    })
    y = bottom - 24
  }

  /** Horizontal bars with the value printed at each end, for a short ranked list. */
  function barList(
    title: string,
    rows: { label: string; value: number; shown: string }[],
    { left = MARGIN, span = CONTENT_WIDTH }: Area = {},
  ) {
    const rowHeight = 16
    ensure(rowHeight * Math.min(rows.length, 4) + 20)
    caption(title, left, 6.5)
    const labelWidth = Math.min(120, span * 0.35)
    const barSpace = span - labelWidth - 44
    const max = Math.max(1, ...rows.map((row) => row.value))
    for (const row of rows) {
      ensure(rowHeight)
      const top = y
      page.drawText(clean(row.label), {
        x: left,
        y: top - 11,
        size: 8.5,
        font: regular,
        color: PDF_COLORS.ink,
      })
      const barWidth = Math.max(2, (barSpace * row.value) / max)
      page.drawRectangle({
        x: left + labelWidth,
        y: top - 12,
        width: barWidth,
        height: 9,
        color: PDF_COLORS.brand,
      })
      page.drawText(clean(row.shown), {
        x: left + labelWidth + barWidth + 5,
        y: top - 11,
        size: 8.5,
        font: regular,
        color: PDF_COLORS.ink,
      })
      y -= rowHeight
    }
    y -= 10
  }

  /** Draws blocks in equal columns from the same top, then continues below the tallest. */
  function sideBySide(height: number, blocks: ((area: Required<Area>) => void)[], gap = 14) {
    ensure(height)
    const span = (CONTENT_WIDTH - gap * (blocks.length - 1)) / blocks.length
    const top = y
    let lowest = y
    blocks.forEach((block, index) => {
      y = top
      block({ left: MARGIN + index * (span + gap), span })
      lowest = Math.min(lowest, y)
    })
    y = lowest
  }

  function space(points: number) {
    y -= points
  }

  return {
    paragraph,
    heading,
    tiles,
    table,
    lineChart,
    barList,
    sideBySide,
    space,
    pageCount: () => document.getPageCount(),
    save: () => document.save(),
  }
}

export type PdfWriter = Awaited<ReturnType<typeof createWriter>>
