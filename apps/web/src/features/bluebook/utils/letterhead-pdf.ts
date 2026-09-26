import {
  concatTransformationMatrix,
  degrees,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import { LETTERHEAD_ARTWORK } from './letterhead-artwork'
import { LETTERHEAD_LOGO } from './letterhead-logo'
import { LETTERHEAD_COLORS, type DrawnLayout, type LetterheadLayout } from './letterhead-templates'

const MARGIN = 40
// Room between the artwork's lowest point and where the page's own content starts.
const ARTWORK_GAP = 12

export class LockedPdfError extends Error {}

type Point = { x: number; y: number }

function colorOf(hex: string) {
  const value = Number.parseInt(hex, 16)
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

/**
 * Maps a point on the page as it is displayed (origin bottom-left, upright) into the page's own
 * user space, which a /Rotate entry turns under the reader.
 */
function viewOf(page: PDFPage) {
  const box = page.getCropBox()
  const rotation = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270
  const sideways = rotation === 90 || rotation === 270

  const toUser = ({ x: u, y: v }: Point): Point => {
    switch (rotation) {
      case 90:
        return { x: box.x + box.width - v, y: box.y + u }
      case 180:
        return { x: box.x + box.width - u, y: box.y + box.height - v }
      case 270:
        return { x: box.x + v, y: box.y + box.height - u }
      default:
        return { x: box.x + u, y: box.y + v }
    }
  }

  return {
    width: sideways ? box.height : box.width,
    height: sideways ? box.width : box.height,
    rotate: degrees(rotation),
    toUser,
  }
}

type View = ReturnType<typeof viewOf>

interface Reserve {
  top: number
  bottom: number
}

/** Artwork scales with the page width, so a wider page gives up a taller band. */
export function reserveOf(layout: LetterheadLayout, width: number): Reserve {
  if (layout.kind === 'drawn') return { top: layout.headerHeight, bottom: layout.footerHeight }
  const { header, footer } = LETTERHEAD_ARTWORK
  return {
    top: (width * header.height) / header.width + ARTWORK_GAP,
    bottom: (width * footer.height) / footer.width + ARTWORK_GAP / 2,
  }
}

/** How far the page's own content shrinks, and where it lands, to clear the letterhead. */
export function fitContent(width: number, height: number, reserve: Reserve) {
  const scale = (height - reserve.top - reserve.bottom) / height
  return { scale, offsetX: (width - width * scale) / 2, offsetY: reserve.bottom }
}

function shrinkContent(document: PDFDocument, page: PDFPage, view: View, reserve: Reserve) {
  const { scale, offsetX, offsetY } = fitContent(view.width, view.height, reserve)
  const origin = view.toUser({ x: 0, y: 0 })
  const target = view.toUser({ x: offsetX, y: offsetY })
  const move = { x: target.x - scale * origin.x, y: target.y - scale * origin.y }
  const transform = (point: Point) => ({
    x: scale * point.x + move.x,
    y: scale * point.y + move.y,
  })

  // pdf-lib's own scaleContent also wraps its drawing stream, which would shrink the letterhead.
  page.node.normalize()
  const start = document.context.register(
    document.context.contentStream([
      pushGraphicsState(),
      concatTransformationMatrix(scale, 0, 0, scale, move.x, move.y),
    ]),
  )
  const end = document.context.register(document.context.contentStream([popGraphicsState()]))
  page.node.wrapContentStreams(start, end)

  moveAnnotations(page, transform)
}

/** Links and form fields follow the content they sit on, or a click lands on the wrong spot. */
function moveAnnotations(page: PDFPage, transform: (point: Point) => Point) {
  const annotations = page.node.Annots()
  if (!annotations) return

  for (let index = 0; index < annotations.size(); index++) {
    const annotation = annotations.lookupMaybe(index, PDFDict)
    if (!annotation) continue
    for (const key of ['Rect', 'QuadPoints']) {
      const points = annotation.lookupMaybe(PDFName.of(key), PDFArray)
      if (!points) continue
      for (let at = 0; at + 1 < points.size(); at += 2) {
        const x = points.lookupMaybe(at, PDFNumber)
        const y = points.lookupMaybe(at + 1, PDFNumber)
        if (!x || !y) continue
        const moved = transform({ x: x.asNumber(), y: y.asNumber() })
        points.set(at, PDFNumber.of(moved.x))
        points.set(at + 1, PDFNumber.of(moved.y))
      }
    }
  }
}

/** Standard fonts only speak WinAnsi; anything else would throw mid-draw. */
function printable(font: PDFFont, text: string) {
  const known = new Set(font.getCharacterSet())
  return [...text].filter((char) => known.has(char.codePointAt(0) ?? 0)).join('')
}

function fitText(font: PDFFont, text: string, size: number, maxWidth: number) {
  let fitted = printable(font, text)
  while (fitted.length > 1 && font.widthOfTextAtSize(fitted, size) > maxWidth) {
    fitted = `${fitted.slice(0, -2).trimEnd()}…`
  }
  return fitted
}

interface Kit {
  logo: Awaited<ReturnType<PDFDocument['embedPng']>>
  bold: PDFFont
  regular: PDFFont
  organizationName: string
}

function drawHeader(page: PDFPage, view: View, layout: DrawnLayout, kit: Kit) {
  const at = (point: Point) => ({ ...view.toUser(point), rotate: view.rotate })
  const top = view.height
  const logoHeight = layout.logoHeight
  const logoWidth = (LETTERHEAD_LOGO.width / LETTERHEAD_LOGO.height) * logoHeight
  const logoBottom = top - (layout.headerHeight + logoHeight) / 2

  if (layout.band) {
    page.drawRectangle({
      ...at({ x: 0, y: top - layout.headerHeight }),
      width: view.width,
      height: layout.headerHeight,
      color: colorOf(LETTERHEAD_COLORS.navy),
    })
  }

  const logoX = layout.align === 'center' ? (view.width - logoWidth) / 2 : MARGIN
  page.drawImage(kit.logo, {
    ...at({ x: logoX, y: logoBottom }),
    width: logoWidth,
    height: logoHeight,
  })

  if (layout.align === 'left') {
    const size = 13
    const name = fitText(
      kit.bold,
      kit.organizationName,
      size,
      view.width - 2 * MARGIN - logoWidth - 16,
    )
    const width = kit.bold.widthOfTextAtSize(name, size)
    page.drawText(name, {
      ...at({ x: view.width - MARGIN - width, y: logoBottom + logoHeight / 2 - size / 3 }),
      size,
      font: kit.bold,
      color: colorOf(layout.band ? LETTERHEAD_COLORS.white : LETTERHEAD_COLORS.navy),
    })
  }

  if (layout.rule) {
    const y = top - layout.headerHeight + 8
    page.drawLine({
      start: view.toUser({ x: MARGIN, y }),
      end: view.toUser({ x: view.width - MARGIN, y }),
      thickness: 1.5,
      color: colorOf(LETTERHEAD_COLORS.brand),
    })
  }
}

function drawFooter(
  page: PDFPage,
  view: View,
  layout: DrawnLayout,
  kit: Kit,
  pageNumber: number,
  pageCount: number,
) {
  if (layout.footerHeight === 0) return
  const at = (point: Point) => ({ ...view.toUser(point), rotate: view.rotate })
  const ruleY = layout.footerHeight - 10
  const size = 8
  const ink = colorOf(LETTERHEAD_COLORS.ink)

  page.drawLine({
    start: view.toUser({ x: MARGIN, y: ruleY }),
    end: view.toUser({ x: view.width - MARGIN, y: ruleY }),
    thickness: layout.band ? 3 : 1,
    color: colorOf(layout.band ? LETTERHEAD_COLORS.brand : LETTERHEAD_COLORS.mint),
  })

  const counter = `Page ${pageNumber} of ${pageCount}`
  const counterWidth = kit.regular.widthOfTextAtSize(counter, size)
  const name = fitText(
    kit.regular,
    kit.organizationName,
    size,
    view.width - 2 * MARGIN - counterWidth - 16,
  )
  const baseline = ruleY - 14

  page.drawText(name, { ...at({ x: MARGIN, y: baseline }), size, font: kit.regular, color: ink })
  page.drawText(counter, {
    ...at({ x: view.width - MARGIN - counterWidth, y: baseline }),
    size,
    font: kit.regular,
    color: ink,
  })
}

type Art = Awaited<ReturnType<PDFDocument['embedPng']>>

function drawArtwork(page: PDFPage, view: View, header: Art, footer: Art) {
  const headerHeight = (view.width * header.height) / header.width
  const footerHeight = (view.width * footer.height) / footer.width
  const rotate = view.rotate

  page.drawImage(header, {
    ...view.toUser({ x: 0, y: view.height - headerHeight }),
    rotate,
    width: view.width,
    height: headerHeight,
  })
  page.drawImage(footer, {
    ...view.toUser({ x: 0, y: 0 }),
    rotate,
    width: view.width,
    height: footerHeight,
  })
}

/** Shrinks every page just enough to clear the letterhead, then draws it on top. */
export async function letterheadPdf(
  bytes: Uint8Array,
  layout: LetterheadLayout,
  organizationName: string,
): Promise<Uint8Array> {
  // Loaded past the lock only to detect it: stamping would corrupt what a key still protects.
  const document = await PDFDocument.load(bytes, { ignoreEncryption: true })
  if (document.isEncrypted) throw new LockedPdfError()
  const pages = document.getPages()

  if (layout.kind === 'artwork') {
    const header = await document.embedPng(LETTERHEAD_ARTWORK.header.base64)
    const footer = await document.embedPng(LETTERHEAD_ARTWORK.footer.base64)
    for (const page of pages) {
      const view = viewOf(page)
      shrinkContent(document, page, view, reserveOf(layout, view.width))
      drawArtwork(page, view, header, footer)
    }
    return document.save()
  }

  const kit: Kit = {
    logo: await document.embedPng(LETTERHEAD_LOGO.base64),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    regular: await document.embedFont(StandardFonts.Helvetica),
    organizationName,
  }
  pages.forEach((page, index) => {
    const view = viewOf(page)
    shrinkContent(document, page, view, reserveOf(layout, view.width))
    drawHeader(page, view, layout, kit)
    drawFooter(page, view, layout, kit, index + 1, pages.length)
  })

  return document.save()
}
