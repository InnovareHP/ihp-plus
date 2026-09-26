import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  degrees,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
  type PDFPage,
} from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { applyLetterhead, LetterheadError } from './letterhead'
import { docxClearance, withLetterhead } from './letterhead-docx'
import { fitContent } from './letterhead-pdf'
import { LETTERHEAD_LAYOUTS } from './letterhead-templates'

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

async function pdfWithLink(rotation = 0) {
  const document = await PDFDocument.create()
  const page = document.addPage([612, 792])
  page.setRotation(degrees(rotation))
  page.drawText('Time-off policy', { x: 72, y: 700 })
  const link = document.context.register(
    document.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [72, 700, 172, 720],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://example.com') },
    }),
  )
  page.node.set(PDFName.of('Annots'), document.context.obj([link]))
  return document.save()
}

function rectOf(page: PDFPage) {
  const rect = page.node.Annots()?.lookupMaybe(0, PDFDict)?.lookup(PDFName.of('Rect'), PDFArray)
  return [0, 1, 2, 3].map((index) => rect?.lookup(index, PDFNumber).asNumber())
}

function docx(documentXml: string) {
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/_rels/document.xml.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
    ),
    'word/document.xml': strToU8(documentXml),
  })
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

describe('applyLetterhead', () => {
  it('returns the file untouched with no letterhead or an unsupported type', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const input = { bytes, organizationName: 'IHP+' }

    expect(await applyLetterhead({ ...input, contentType: PDF, template: 'none' })).toBe(bytes)
    expect(
      await applyLetterhead({ ...input, contentType: 'text/plain', template: 'classic' }),
    ).toBe(bytes)
  })

  it('explains a file it cannot read instead of storing it half-stamped', async () => {
    await expect(
      applyLetterhead({
        bytes: strToU8('not a pdf'),
        contentType: PDF,
        template: 'classic',
        organizationName: 'IHP+',
      }),
    ).rejects.toThrow(LetterheadError)
  })

  it('names a password-protected PDF as the reason', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    document.context.trailerInfo.Encrypt = document.context.obj({ Filter: 'Standard' })
    const bytes = await document.save({ useObjectStreams: false })

    await expect(
      applyLetterhead({ bytes, contentType: PDF, template: 'classic', organizationName: 'IHP+' }),
    ).rejects.toThrow(/password-protected/)
  })
})

describe('the PDF letterhead', () => {
  it('shrinks the page to leave exactly the header and footer bands clear', () => {
    const layout = LETTERHEAD_LAYOUTS.classic
    const fit = fitContent(612, 792, layout)

    expect(792 * fit.scale).toBeCloseTo(792 - layout.headerHeight - layout.footerHeight)
    expect(fit.offsetY).toBe(layout.footerHeight)
    expect(fit.offsetX * 2 + 612 * fit.scale).toBeCloseTo(612)
  })

  it('keeps every page and moves a link with the content under it', async () => {
    const stamped = await applyLetterhead({
      bytes: await pdfWithLink(),
      contentType: PDF,
      template: 'classic',
      organizationName: 'Integrated Health Partners',
    })
    const page = (await PDFDocument.load(stamped)).getPages()[0]
    if (!page) throw new Error('no page')

    const { scale, offsetX, offsetY } = fitContent(612, 792, LETTERHEAD_LAYOUTS.classic)
    const expected = [72, 700, 172, 720].map((value, index) =>
      index % 2 === 0 ? value * scale + offsetX : value * scale + offsetY,
    )
    rectOf(page).forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? NaN))
    expect(page.getSize()).toEqual({ width: 612, height: 792 })
  })

  it('stamps a rotated page without losing its rotation', async () => {
    const stamped = await applyLetterhead({
      bytes: await pdfWithLink(90),
      contentType: PDF,
      template: 'banner',
      organizationName: 'IHP+ 医療',
    })
    const page = (await PDFDocument.load(stamped)).getPages()[0]

    expect(page?.getRotation().angle).toBe(90)
  })
})

describe('the Word letterhead', () => {
  const body =
    `<w:document ${W}><w:body><w:p><w:r><w:t>Policy</w:t></w:r></w:p>` +
    '<w:sectPr><w:headerReference w:type="default" r:id="rIdOld"/><w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="720" w:right="1440" w:bottom="720" w:left="1440" w:header="360" w:footer="360" w:gutter="0"/>' +
    '<w:titlePg/></w:sectPr></w:body></w:document>'

  it('adds a header, a footer and the logo as real Word parts', async () => {
    const stamped = await applyLetterhead({
      bytes: docx(body),
      contentType: DOCX,
      template: 'classic',
      organizationName: 'Smith & Co <Health>',
    })
    const files = unzipSync(stamped)
    const read = (path: string) => strFromU8(files[path] ?? new Uint8Array())

    expect(read('word/header-ihp-letterhead.xml')).toContain('Smith &amp; Co &lt;Health&gt;')
    expect(read('word/footer-ihp-letterhead.xml')).toContain('NUMPAGES')
    expect(files['word/media/ihp-letterhead-logo.png']?.byteLength).toBeGreaterThan(0)
    expect(read('word/_rels/document.xml.rels')).toContain('Target="header-ihp-letterhead.xml"')
    expect(read('[Content_Types].xml')).toContain('/word/header-ihp-letterhead.xml')
    expect(read('[Content_Types].xml')).toContain('Extension="png"')

    const document = read('word/document.xml')
    expect(document).not.toContain('rIdOld')
    expect(document).toContain('xmlns:r=')
  })

  it('grows the margins until the body clears the letterhead', () => {
    const layout = LETTERHEAD_LAYOUTS.classic
    const section = withLetterhead(/<w:sectPr>[\s\S]*<\/w:sectPr>/.exec(body)?.[0] ?? '', layout)
    const clearance = docxClearance(layout)

    expect(section).toContain(`w:top="${360 + clearance.header}"`)
    expect(section).toContain(`w:bottom="${360 + clearance.footer}"`)
    // Schema order: references first, then page size, margins, and the title-page flag.
    expect(section.indexOf('headerReference')).toBeLessThan(section.indexOf('<w:pgSz'))
    expect(section.indexOf('<w:pgSz')).toBeLessThan(section.indexOf('<w:pgMar'))
    expect(section).toContain('w:type="first"')
  })

  it('never shrinks a margin that is already deep enough', () => {
    const section = withLetterhead(
      '<w:sectPr><w:pgMar w:top="4000" w:bottom="4000" w:header="720" w:footer="720"/></w:sectPr>',
      LETTERHEAD_LAYOUTS.minimal,
    )

    expect(section).toContain('w:top="4000"')
    expect(section).not.toContain('footerReference')
  })

  it('gives a document with no section of its own one to carry the letterhead', async () => {
    const stamped = await applyLetterhead({
      bytes: docx(`<w:document ${W}><w:body><w:p/></w:body></w:document>`),
      contentType: DOCX,
      template: 'minimal',
      organizationName: 'IHP+',
    })
    const document = strFromU8(unzipSync(stamped)['word/document.xml'] ?? new Uint8Array())

    expect(document).toMatch(/<w:sectPr><w:headerReference[\s\S]*<w:pgMar [^>]*w:top="\d+"/)
  })

  it('refuses a zip that is not a Word document', async () => {
    await expect(
      applyLetterhead({
        bytes: zipSync({ 'readme.txt': strToU8('hi') }),
        contentType: DOCX,
        template: 'classic',
        organizationName: 'IHP+',
      }),
    ).rejects.toThrow(LetterheadError)
  })
})
