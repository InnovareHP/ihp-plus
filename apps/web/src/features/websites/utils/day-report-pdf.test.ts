import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { DayReport, ReportSite } from './day-report'
import { dayReportPdf, wrapText } from './day-report-pdf'

function report(sites: ReportSite[], overrides: Partial<DayReport> = {}): DayReport {
  return {
    date: '2026-11-05',
    dateLabel: 'Nov 5, 2026',
    zoneLabel: 'Philippine Standard Time (GMT+8)',
    shiftStart: 'Nov 5, 2026 · 8:00 PM',
    shiftEnd: 'Nov 6, 2026 · 4:00 AM',
    shiftHours: '8:00 PM – 4:00 AM',
    itLead: 'Ada Lovelace',
    roundTimes: { clock_in: '8:05 PM', clock_out: 'Not run' },
    summary: {
      clock_in: { up: sites.length, issue: 0, down: 0, unchecked: 0 },
      clock_out: { up: 0, issue: 0, down: 0, unchecked: sites.length },
    },
    sites,
    problems: [],
    manual: {
      pagesPass: 0,
      pagesFail: 0,
      pagesUnchecked: sites.length,
      formTested: 0,
      formFailed: 0,
    },
    hasExpiry: true,
    preparedBy: 'Ada Lovelace',
    generatedAt: 'Nov 6, 2026 · 3:40 AM',
    ...overrides,
  }
}

function site(index: number, note = ''): ReportSite {
  return {
    name: `Site ${index}`,
    url: `https://site-${index}.example`,
    client: '',
    rounds: {
      clock_in: {
        status: 'up',
        time: '8:05 PM',
        reading: 'HTTP 200 in 300 ms',
        note,
        checkedBy: 'Ada Lovelace',
        overridden: false,
      },
    },
    pagesButtons: 'pass',
    formEmail: { result: 'pass', testedOn: 'Nov 2, 2026' },
    findings: note,
    action: note ? 'Told the client' : '',
    domain: { at: 'Mar 14, 2027', days: 128 },
    ssl: { at: 'Nov 20, 2026', days: 14 },
  }
}

describe('dayReportPdf', () => {
  it('fits a short shift on one Letter page', async () => {
    const pdf = await PDFDocument.load(await dayReportPdf(report([site(1), site(2)])))

    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 })
    expect(pdf.getTitle()).toBe('Daily Website Check Report — Nov 5, 2026')
  })

  it('runs a long list onto more pages instead of off the bottom', async () => {
    const sites = Array.from({ length: 30 }, (_, index) =>
      site(index, 'Checked by hand. '.repeat(8)),
    )
    const pdf = await PDFDocument.load(await dayReportPdf(report(sites)))

    expect(pdf.getPageCount()).toBeGreaterThan(1)
  })

  it('prints text the standard font cannot draw instead of failing', async () => {
    const bytes = await dayReportPdf(
      report([{ ...site(1, 'Fixed 🎉 — 完成'), name: 'Café “Résumé”' }], {
        problems: [{ website: 'Café', fixed: false }],
      }),
    )

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})

describe('wrapText', () => {
  it('breaks a word wider than the column instead of overflowing it', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica)
    const lines = wrapText(`https://${'a'.repeat(80)}.example`, font, 9, 100)

    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(100)
  })
})
