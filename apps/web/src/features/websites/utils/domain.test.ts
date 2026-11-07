import { describe, expect, it } from 'vitest'
import { daysUntil, registrableDomain } from './domain'

describe('registrableDomain', () => {
  it('drops subdomains down to the registered name', () => {
    expect(registrableDomain('https://www.cascadinggrace.com/about')).toBe('cascadinggrace.com')
    expect(registrableDomain('https://shop.acme.org')).toBe('acme.org')
  })

  it('keeps the country second level a registry sells under', () => {
    expect(registrableDomain('https://www.acme.com.ph')).toBe('acme.com.ph')
    expect(registrableDomain('https://shop.acme.co.uk')).toBe('acme.co.uk')
    expect(registrableDomain('https://acme.io')).toBe('acme.io')
  })

  it('gives nothing to look up for an address or a bad URL', () => {
    expect(registrableDomain('http://192.168.1.10')).toBeUndefined()
    expect(registrableDomain('not a url')).toBeUndefined()
  })
})

describe('daysUntil', () => {
  it('counts whole days, negative once passed', () => {
    const now = new Date('2026-11-06T00:00:00.000Z')
    expect(daysUntil('2026-11-28T12:00:00.000Z', now)).toBe(22)
    expect(daysUntil('2026-11-01T00:00:00.000Z', now)).toBe(-5)
  })
})
