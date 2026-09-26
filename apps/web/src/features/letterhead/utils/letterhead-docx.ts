import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { LETTERHEAD_ARTWORK } from './letterhead-artwork'
import { LETTERHEAD_LOGO } from './letterhead-logo'
import { LETTERHEAD_COLORS, type DrawnLayout, type LetterheadLayout } from './letterhead-templates'

const TWIPS_PER_POINT = 20
const EMU_PER_POINT = 12700
const EMU_PER_TWIP = 635
// Word's own defaults: US Letter with one-inch margins and half-inch header/footer distances.
const DEFAULT_PAGE = { width: 12240, left: 1440, right: 1440 }
const DEFAULT_MARGIN = { top: 1440, bottom: 1440, header: 720, footer: 720 }
// Body text clears the letterhead by this much, so it never touches the rule.
const GAP = 12 * TWIPS_PER_POINT

const HEADER_PART = 'header-ihp-letterhead.xml'
const FOOTER_PART = 'footer-ihp-letterhead.xml'
const HEADER_ID = 'rIdIhpLetterheadHeader'
const FOOTER_ID = 'rIdIhpLetterheadFooter'
const IMAGE_ID = 'rIdIhpLetterheadImage'

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NAMESPACES = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  `xmlns:r="${REL}"`,
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
].join(' ')
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

function escapeXml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function attribute(tag: string, name: string) {
  const value = new RegExp(`\\bw:${name}="(-?\\d+)"`).exec(tag)?.[1]
  return value === undefined ? undefined : Number(value)
}

function setAttribute(tag: string, name: string, value: number) {
  const pattern = new RegExp(`\\bw:${name}="[^"]*"`)
  if (pattern.test(tag)) return tag.replace(pattern, `w:${name}="${value}"`)
  return tag.replace(/\s*\/>$/, ` w:${name}="${value}"/>`)
}

interface Section {
  pageWidth: number
  headerDistance: number
  footerDistance: number
}

function hasFooter(layout: LetterheadLayout) {
  return layout.kind === 'artwork' || layout.footerHeight > 0
}

/** The smallest top and bottom margins, in twips, that keep the body clear of the letterhead. */
export function requiredMargins(layout: LetterheadLayout, section: Section) {
  if (layout.kind === 'artwork') {
    const { header, footer } = LETTERHEAD_ARTWORK
    return {
      top: Math.round((section.pageWidth * header.height) / header.width) + GAP,
      bottom: Math.round((section.pageWidth * footer.height) / footer.width) + GAP / 2,
    }
  }
  return {
    top: section.headerDistance + (layout.logoHeight + 10) * TWIPS_PER_POINT + GAP,
    bottom: layout.footerHeight === 0 ? 0 : section.footerDistance + 20 * TWIPS_PER_POINT + GAP,
  }
}

function bytesOf(base64: string) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function pictureXml(name: string, width: number, height: number) {
  const extent = `cx="${width}" cy="${height}"`
  return (
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/>` +
    `</pic:nvPicPr><pic:blipFill><a:blip r:embed="${IMAGE_ID}"/><a:stretch><a:fillRect/>` +
    `</a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext ${extent}/>` +
    '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
    '</a:graphicData></a:graphic>'
  )
}

/** Pinned to the page edge rather than the margins, so any margin keeps the art full-bleed. */
function anchoredArtwork(
  id: number,
  name: string,
  width: number,
  height: number,
  edge: 'top' | 'bottom',
) {
  const vertical = edge === 'top' ? '<wp:posOffset>0</wp:posOffset>' : '<wp:align>bottom</wp:align>'
  return (
    '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing>' +
    '<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659264"' +
    ' behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>' +
    '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>' +
    `<wp:positionV relativeFrom="page">${vertical}</wp:positionV>` +
    `<wp:extent cx="${width}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:wrapNone/><wp:docPr id="${id}" name="${name}" descr="IHP+ letterhead"/>` +
    `<wp:cNvGraphicFramePr/>${pictureXml(name, width, height)}</wp:anchor></w:drawing></w:r></w:p>`
  )
}

function logoRun(layout: DrawnLayout, organizationName: string) {
  const height = Math.round(layout.logoHeight * EMU_PER_POINT)
  const width = Math.round((LETTERHEAD_LOGO.width / LETTERHEAD_LOGO.height) * height)
  const name = escapeXml(`${organizationName} logo`)

  return (
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${width}" cy="${height}"/>` +
    `<wp:docPr id="7301" name="Letterhead logo" descr="${name}"/>` +
    `${pictureXml('ihp-letterhead-logo.png', width, height)}</wp:inline></w:drawing></w:r>`
  )
}

function textRun(text: string, props: string) {
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function fieldRun(instruction: string, props: string) {
  return `<w:fldSimple w:instr=" ${instruction} ">${textRun('1', props)}</w:fldSimple>`
}

function headerXml(layout: DrawnLayout, organizationName: string, contentWidth: number) {
  const paragraph: string[] = ['<w:spacing w:before="0" w:after="0"/>']
  if (layout.band)
    paragraph.push(`<w:shd w:val="clear" w:color="auto" w:fill="${LETTERHEAD_COLORS.navy}"/>`)
  if (layout.rule) {
    paragraph.push(
      `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="${LETTERHEAD_COLORS.brand}"/></w:pBdr>`,
    )
  }
  if (layout.align === 'center') paragraph.push('<w:jc w:val="center"/>')
  else paragraph.push(`<w:tabs><w:tab w:val="right" w:pos="${contentWidth}"/></w:tabs>`)

  // Half-points, so the name sits level with the logo's middle instead of on its baseline.
  const lift = Math.round(layout.logoHeight) - 8
  const color = layout.band ? LETTERHEAD_COLORS.white : LETTERHEAD_COLORS.navy
  const name =
    layout.align === 'left'
      ? '<w:r><w:tab/></w:r>' +
        textRun(
          organizationName,
          `<w:b/><w:color w:val="${color}"/><w:position w:val="${lift}"/><w:sz w:val="26"/>`,
        )
      : ''

  return (
    `${XML_DECLARATION}<w:hdr ${NAMESPACES}><w:p><w:pPr>${sortPPr(paragraph)}</w:pPr>` +
    `${logoRun(layout, organizationName)}${name}</w:p></w:hdr>`
  )
}

/** CT_PPr is an ordered sequence, and Word refuses a document whose children are out of order. */
function sortPPr(children: string[]) {
  const order = ['pBdr', 'shd', 'tabs', 'spacing', 'jc']
  const rank = (child: string) => order.findIndex((tag) => child.startsWith(`<w:${tag}`))
  return [...children].sort((a, b) => rank(a) - rank(b)).join('')
}

function footerXml(layout: DrawnLayout, organizationName: string, contentWidth: number) {
  const color = layout.band ? LETTERHEAD_COLORS.brand : LETTERHEAD_COLORS.mint
  const size = layout.band ? 24 : 8
  const props = `<w:color w:val="${LETTERHEAD_COLORS.ink}"/><w:sz w:val="16"/>`

  return (
    `${XML_DECLARATION}<w:ftr ${NAMESPACES}><w:p><w:pPr>` +
    `<w:pBdr><w:top w:val="single" w:sz="${size}" w:space="6" w:color="${color}"/></w:pBdr>` +
    `<w:tabs><w:tab w:val="right" w:pos="${contentWidth}"/></w:tabs>` +
    '<w:spacing w:before="0" w:after="0"/></w:pPr>' +
    `${textRun(organizationName, props)}<w:r><w:tab/></w:r>${textRun('Page ', props)}` +
    `${fieldRun('PAGE', props)}${textRun(' of ', props)}${fieldRun('NUMPAGES', props)}` +
    '</w:p></w:ftr>'
  )
}

// Every child CT_SectPr allows after pgMar; a missing pgMar goes in front of the first of these.
const AFTER_PG_MAR =
  /<w:(?:paperSrc|pgBorders|lnNumType|pgNumType|cols|formProt|vAlign|noEndnote|titlePg|textDirection|bidi|rtlGutter|docGrid|printerSettings|sectPrChange)\b/

/** Points a section at the letterhead parts and grows its margins until the body clears them. */
export function withLetterhead(sectPr: string, layout: LetterheadLayout) {
  const selfClosing = sectPr.endsWith('/>')
  const open = selfClosing
    ? sectPr.replace(/\s*\/>$/, '>')
    : (/^<w:sectPr\b[^>]*>/.exec(sectPr)?.[0] ?? '<w:sectPr>')
  let body = selfClosing ? '' : sectPr.slice(open.length, -'</w:sectPr>'.length)

  body = body.replace(/<w:(?:header|footer)Reference\b[^>]*\/>/g, '')

  const existing = /<w:pgMar\b[^>]*\/>/.exec(body)?.[0]
  let margin = existing ?? '<w:pgMar/>'
  const headerDistance = attribute(margin, 'header') ?? DEFAULT_MARGIN.header
  const footerDistance = attribute(margin, 'footer') ?? DEFAULT_MARGIN.footer
  const top = attribute(margin, 'top') ?? DEFAULT_MARGIN.top
  const bottom = attribute(margin, 'bottom') ?? DEFAULT_MARGIN.bottom

  const size = /<w:pgSz\b[^>]*\/>/.exec(body)?.[0] ?? ''
  const needed = requiredMargins(layout, {
    pageWidth: attribute(size, 'w') ?? DEFAULT_PAGE.width,
    headerDistance,
    footerDistance,
  })

  margin = setAttribute(margin, 'top', Math.max(Math.abs(top), needed.top))
  if (needed.bottom > 0) {
    margin = setAttribute(margin, 'bottom', Math.max(Math.abs(bottom), needed.bottom))
  }
  for (const [name, fallback] of [
    ['header', DEFAULT_MARGIN.header],
    ['footer', DEFAULT_MARGIN.footer],
    ['left', DEFAULT_PAGE.left],
    ['right', DEFAULT_PAGE.right],
    ['gutter', 0],
  ] as const) {
    if (attribute(margin, name) === undefined) margin = setAttribute(margin, name, fallback)
  }

  if (existing) body = body.replace(existing, margin)
  else if (/<w:pgSz\b[^>]*\/>/.test(body))
    body = body.replace(/<w:pgSz\b[^>]*\/>/, (size) => size + margin)
  else {
    const at = AFTER_PG_MAR.exec(body)?.index ?? body.length
    body = body.slice(0, at) + margin + body.slice(at)
  }

  // Default and first-page both, so a section with a distinct title page still carries it.
  const references = ['default', 'first', 'even']
    .map((type) => `<w:headerReference w:type="${type}" r:id="${HEADER_ID}"/>`)
    .concat(
      hasFooter(layout)
        ? ['default', 'first', 'even'].map(
            (type) => `<w:footerReference w:type="${type}" r:id="${FOOTER_ID}"/>`,
          )
        : [],
    )
    .join('')

  return `${open}${references}${body}</w:sectPr>`
}

function widthsOf(sectPr: string | undefined) {
  const size = /<w:pgSz\b[^>]*\/>/.exec(sectPr ?? '')?.[0] ?? ''
  const margin = /<w:pgMar\b[^>]*\/>/.exec(sectPr ?? '')?.[0] ?? ''
  const page = attribute(size, 'w') ?? DEFAULT_PAGE.width
  const left = attribute(margin, 'left') ?? DEFAULT_PAGE.left
  const right = attribute(margin, 'right') ?? DEFAULT_PAGE.right
  const gutter = attribute(margin, 'gutter') ?? 0
  return { page, content: Math.max(page - left - right - gutter, 1440) }
}

interface Part {
  xml: string
  image: { path: string; bytes: Uint8Array } | undefined
}

function artworkPart(
  kind: 'header' | 'footer',
  art: { width: number; height: number; base64: string },
  pageWidth: number,
): Part {
  const width = pageWidth * EMU_PER_TWIP
  const height = Math.round((width * art.height) / art.width)
  const root = kind === 'header' ? 'w:hdr' : 'w:ftr'
  const name = `ihp-letterhead-${kind}.png`
  const drawing =
    kind === 'header'
      ? anchoredArtwork(7301, name, width, height, 'top')
      : anchoredArtwork(7302, name, width, height, 'bottom')
  return {
    xml: `${XML_DECLARATION}<${root} ${NAMESPACES}>${drawing}</${root}>`,
    image: { path: `media/${name}`, bytes: bytesOf(art.base64) },
  }
}

/** The header and footer parts one template adds, each with the image its drawing embeds. */
function partsOf(
  layout: LetterheadLayout,
  organizationName: string,
  widths: { page: number; content: number },
): { header: Part; footer: Part | undefined } {
  if (layout.kind === 'artwork') {
    return {
      header: artworkPart('header', LETTERHEAD_ARTWORK.header, widths.page),
      footer: artworkPart('footer', LETTERHEAD_ARTWORK.footer, widths.page),
    }
  }
  const logo = { path: 'media/ihp-letterhead-logo.png', bytes: bytesOf(LETTERHEAD_LOGO.base64) }
  return {
    header: { xml: headerXml(layout, organizationName, widths.content), image: logo },
    footer:
      layout.footerHeight > 0
        ? { xml: footerXml(layout, organizationName, widths.content), image: undefined }
        : undefined,
  }
}

function addRelationship(rels: string, id: string, type: string, target: string) {
  const without = rels.replace(new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*/>`, 'g'), '')
  return without.replace(
    '</Relationships>',
    `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/></Relationships>`,
  )
}

function addContentType(types: string, part: string, contentType: string) {
  if (types.includes(`PartName="${part}"`)) return types
  return types.replace(
    '</Types>',
    `<Override PartName="${part}" ContentType="${contentType}"/></Types>`,
  )
}

function mainDocumentPath(files: Record<string, Uint8Array>) {
  const root = files['_rels/.rels']
  const target = root
    ? /Type="[^"]*\/officeDocument"[^>]*Target="\/?([^"]+)"|Target="\/?([^"]+)"[^>]*Type="[^"]*\/officeDocument"/.exec(
        strFromU8(root),
      )
    : undefined
  return target?.[1] ?? target?.[2] ?? 'word/document.xml'
}

/** Adds the letterhead as a real Word header and footer, so it repeats and stays editable. */
export function letterheadDocx(
  bytes: Uint8Array,
  layout: LetterheadLayout,
  organizationName: string,
): Uint8Array {
  const files = unzipSync(bytes)
  const documentPath = mainDocumentPath(files)
  const directory = documentPath.includes('/')
    ? documentPath.slice(0, documentPath.lastIndexOf('/') + 1)
    : ''
  const relsPath = `${directory}_rels/${documentPath.slice(directory.length)}.rels`
  const documentFile = files[documentPath]
  const relsFile = files[relsPath]
  const typesFile = files['[Content_Types].xml']
  if (!documentFile || !relsFile || !typesFile) throw new Error('Not a Word document')

  let document = strFromU8(documentFile)
  if (!document.includes('</w:body>')) throw new Error('No document body')
  // A document relying on Word's default section has no sectPr at all, so it gets one.
  if (!/<w:sectPr\b/.test(document))
    document = document.replace('</w:body>', '<w:sectPr/></w:body>')

  const sections = document.match(/<w:sectPr\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:sectPr>)/g) ?? []
  const parts = partsOf(layout, organizationName, widthsOf(sections.at(-1)))
  document = document.replace(/<w:sectPr\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:sectPr>)/g, (section) =>
    withLetterhead(section, layout),
  )
  // The references use the r: prefix, which a hand-rolled document may never have declared.
  if (!/xmlns:r=/.test(document))
    document = document.replace(/<w:document\b/, `<w:document xmlns:r="${REL}"`)

  let rels = strFromU8(relsFile)
  let types = strFromU8(typesFile)
  if (!/Extension="png"/i.test(types)) {
    types = types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
  }

  const out: Zippable = { ...files }
  out[documentPath] = strToU8(document)

  const placed = [
    { part: parts.header, id: HEADER_ID, kind: 'header', file: HEADER_PART },
    { part: parts.footer, id: FOOTER_ID, kind: 'footer', file: FOOTER_PART },
  ] as const
  for (const { part, id, kind, file } of placed) {
    if (!part) continue
    rels = addRelationship(rels, id, kind, file)
    types = addContentType(
      types,
      `/${directory}${file}`,
      `application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}+xml`,
    )
    out[`${directory}${file}`] = strToU8(part.xml)
    if (!part.image) continue
    out[`${directory}${part.image.path}`] = part.image.bytes
    out[`${directory}_rels/${file}.rels`] = strToU8(
      `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="${IMAGE_ID}" Type="${REL}/image" Target="${part.image.path}"/></Relationships>`,
    )
  }

  out[relsPath] = strToU8(rels)
  out['[Content_Types].xml'] = strToU8(types)
  return zipSync(out)
}
