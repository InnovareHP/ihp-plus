import { describe, expect, it } from 'vitest'
import { monthCsv, monthCsvName } from './csv'

const CHECK = {
  status: 'up' as const,
  httpStatus: 200,
  responseMs: 240,
  error: '',
  note: '',
  checkedByName: 'Ada Lovelace',
  checkedAt: '2026-10-01T01:05:00.000Z',
}

describe('monthCsv', () => {
  it('puts both rounds of a day on one row and marks a missed round', () => {
    const csv = monthCsv({
      month: '2026-10',
      timeZone: 'Asia/Manila',
      rows: [
        {
          date: '2026-10-01',
          website: 'Riverside site',
          url: 'https://riverside.example',
          client: 'Riverside Care Center',
          checks: { clock_in: CHECK },
        },
      ],
    })
    const [header, row] = csv.split('\n')

    expect(header).toContain('Time in status')
    expect(header).toContain('Time out note')
    expect(row).toContain(
      '2026-10-01,Riverside Care Center,Riverside site,https://riverside.example',
    )
    expect(row).toContain('Running')
    expect(row).toContain('Ada Lovelace')
    expect(row).toContain('HTTP 200 in 240 ms')
    expect(row).toContain('Not checked')
  })

  it('quotes commas and defuses text a spreadsheet would run as a formula', () => {
    const csv = monthCsv({
      month: '2026-10',
      timeZone: 'UTC',
      rows: [
        {
          date: '2026-10-02',
          website: 'Main, public site',
          url: 'https://a.example',
          client: '',
          checks: { clock_out: { ...CHECK, status: 'down', note: '=HYPERLINK("x")' } },
        },
      ],
    })

    expect(csv).toContain('"Main, public site"')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('names the file after the month', () => {
    expect(monthCsvName('2026-10')).toBe('website-checks-2026-10.csv')
  })
})
