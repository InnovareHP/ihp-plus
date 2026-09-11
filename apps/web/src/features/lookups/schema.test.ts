import { describe, expect, it } from 'vitest'
import { isLookupKind, LOOKUP_KIND_LABELS, LOOKUP_KINDS, parseOptionList } from './schema'

describe('lookup kinds', () => {
  it('labels every kind, so no dropdown renders a bare key', () => {
    for (const kind of LOOKUP_KINDS) expect(LOOKUP_KIND_LABELS[kind]).toBeTruthy()
  })

  it('rejects a kind nothing implements', () => {
    expect(isLookupKind('position')).toBe(true)
    expect(isLookupKind('salaryBand')).toBe(false)
  })
})

describe('parseOptionList', () => {
  it('splits a pasted spreadsheet column, however it was separated', () => {
    expect(parseOptionList('Hospital\nHospice, Payer;Broker\tVendor')).toEqual([
      'Hospital',
      'Hospice',
      'Payer',
      'Broker',
      'Vendor',
    ])
  })

  it('drops blanks and collapses inner whitespace', () => {
    expect(parseOptionList('  Home   health  \n\n\n  ')).toEqual(['Home health'])
  })

  it('keeps the first of a case-insensitive duplicate', () => {
    expect(parseOptionList('Hospice\nhospice\nHOSPICE')).toEqual(['Hospice'])
  })

  it('ignores a value too long to be a dropdown label', () => {
    expect(parseOptionList(`Payer\n${'x'.repeat(81)}`)).toEqual(['Payer'])
  })

  it('caps one paste at two hundred values', () => {
    const pasted = Array.from({ length: 250 }, (_, index) => `Value ${index}`).join('\n')
    expect(parseOptionList(pasted)).toHaveLength(200)
  })

  it('returns nothing for an empty box, so the add button stays disabled', () => {
    expect(parseOptionList('   ')).toEqual([])
  })
})
