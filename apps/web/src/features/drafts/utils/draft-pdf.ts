import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from 'pdf-lib'
import { INNOVARE_ARTWORK } from '@/features/letterhead/utils/letterhead-artwork-innovare'
import { parseDocument, type BlockKind } from './document'

// US Letter in points, the page the letterhead's Word original is set on.
const WIDTH = 612
const HEIGHT = 792
const MARGIN = 72
const GAP = 25
const BULLET_INDENT = 14

const INK = rgb(0x22 / 255, 0x22 / 255, 0x22 / 255)
const NAVY = rgb(0x0b / 255, 0x28 / 255, 0x6b / 255)
const BRAND = rgb(0x13 / 255, 0x46 / 255, 0xc5 / 255)

const STYLE: Record<BlockKind, { size: number; bold: boolean; before: number; leading: number }> = {
  title: { size: 18, bold: true, before: 0, leading: 22 },
  heading: { size: 12, bold: true, before: 16, leading: 16 },
  paragraph: { size: 10.5, bold: false, before: 8, leading: 15 },
  bullet: { size: 10.5, bold: false, before: 4, leading: 15 },
}

/** Standard fonts only speak WinAnsi; anything else would throw mid-draw. */
function printable(font: PDFFont, text: string) {
  const known = new Set(font.getCharacterSet())
  return [...text].filter((char) => known.has(char.codePointAt(0) ?? 0)).join('')
}

export function wrapWords(font: PDFFont, text: string, size: number, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  for (const word of printable(font, text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  return line ? [...lines, line] : lines
}

/** The draft as a PDF on the Innovare HP letterhead, every page carrying its header and footer. */
export async function draftPdf(title: string, body: string): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(title)
  document.setCreator('Innovare HP')

  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const header: PDFImage = await document.embedPng(INNOVARE_ARTWORK.header.base64)
  const footer: PDFImage = await document.embedPng(INNOVARE_ARTWORK.footer.base64)

  const headerHeight = (WIDTH * INNOVARE_ARTWORK.header.height) / INNOVARE_ARTWORK.header.width
  const footerHeight = (WIDTH * INNOVARE_ARTWORK.footer.height) / INNOVARE_ARTWORK.footer.width
  const top = HEIGHT - headerHeight - GAP
  const bottom = footerHeight + GAP

  const addPage = () => {
    const next = document.addPage([WIDTH, HEIGHT])
    next.drawImage(header, { x: 0, y: HEIGHT - headerHeight, width: WIDTH, height: headerHeight })
    next.drawImage(footer, { x: 0, y: 0, width: WIDTH, height: footerHeight })
    return next
  }

  let page = addPage()
  let y = top

  for (const block of parseDocument(body)) {
    const style = STYLE[block.kind]
    const font = style.bold ? bold : regular
    const indent = block.kind === 'bullet' ? BULLET_INDENT : 0
    const lines = wrapWords(font, block.text, style.size, WIDTH - 2 * MARGIN - indent)

    lines.forEach((line, index) => {
      const gap = index === 0 && y !== top ? style.before : 0
      if (y - gap - style.leading < bottom) {
        page = addPage()
        y = top
      } else {
        y -= gap
      }
      y -= style.leading
      if (block.kind === 'bullet' && index === 0) {
        page.drawText('•', { x: MARGIN + 2, y, size: style.size, font: regular, color: INK })
      }
      page.drawText(line, {
        x: MARGIN + indent,
        y,
        size: style.size,
        font,
        color: block.kind === 'title' ? BRAND : block.kind === 'heading' ? NAVY : INK,
      })
    })
  }

  return document.save()
}
