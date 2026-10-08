import type { CheckStatus } from '../schema'

/** Past this a page still loads, but slowly enough that a client would call it broken. */
export const SLOW_RESPONSE_MS = 5000

export interface ProbeReading {
  httpStatus: number | undefined
  responseMs: number | undefined
  error: string
}

export function verdictOf(reading: ProbeReading): CheckStatus {
  if (reading.error || reading.httpStatus === undefined) return 'down'
  if (reading.httpStatus >= 400) return 'down'
  if ((reading.responseMs ?? 0) > SLOW_RESPONSE_MS) return 'issue'
  return 'up'
}

/** What the probe saw, in words for the lead and the CSV. */
export function describeReading(reading: ProbeReading): string {
  if (reading.error) return reading.error
  if (reading.httpStatus === undefined) return 'No answer'
  const speed = reading.responseMs === undefined ? '' : ` in ${reading.responseMs} ms`
  return `HTTP ${reading.httpStatus}${speed}`
}

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
]

// The probe runs inside our network, so it must never be pointed back at it.
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (ip.startsWith('::ffff:')) return isPrivateAddress(ip.slice(7))
  if (ip.includes(':')) {
    return ip === '::' || ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip)
  }
  return PRIVATE_V4.some((range) => range.test(ip))
}
