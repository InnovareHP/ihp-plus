import { describe, expect, it } from 'vitest'
import { describeReading, isPrivateAddress, SLOW_RESPONSE_MS, verdictOf } from './verdict'

describe('verdictOf', () => {
  it('calls a fast 2xx running', () => {
    expect(verdictOf({ httpStatus: 200, responseMs: 320, error: '' })).toBe('up')
  })

  it('calls a slow answer an issue rather than running', () => {
    expect(verdictOf({ httpStatus: 200, responseMs: SLOW_RESPONSE_MS + 1, error: '' })).toBe(
      'issue',
    )
  })

  it('calls an error status, a failed request or no answer down', () => {
    expect(verdictOf({ httpStatus: 503, responseMs: 90, error: '' })).toBe('down')
    expect(verdictOf({ httpStatus: 404, responseMs: 90, error: '' })).toBe('down')
    expect(verdictOf({ httpStatus: undefined, responseMs: undefined, error: 'Timed out' })).toBe(
      'down',
    )
  })
})

describe('describeReading', () => {
  it('says what came back and how fast', () => {
    expect(describeReading({ httpStatus: 200, responseMs: 412, error: '' })).toBe(
      'HTTP 200 in 412 ms',
    )
  })

  it('prefers the error when the request failed', () => {
    expect(
      describeReading({ httpStatus: undefined, responseMs: undefined, error: 'Could not reach' }),
    ).toBe('Could not reach')
  })
})

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.9',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    'fd00::1',
    '::ffff:10.0.0.1',
  ])('refuses %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each(['93.184.216.34', '172.32.0.1', '2606:4700::6810:85e5'])('allows %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })
})
