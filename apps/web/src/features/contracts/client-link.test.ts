import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientContractUrl, signContractLink, verifyContractLink } from './client-link'

const PUBLISHED = new Date('2026-09-14T09:00:00.000Z')

describe('client contract links', () => {
  beforeEach(() => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'a-test-secret-that-is-long-enough-to-sign')
    vi.stubEnv('BETTER_AUTH_URL', 'https://portal.ihp.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts the signature it issued for that publication', () => {
    const signature = signContractLink('contract-1', PUBLISHED)

    expect(verifyContractLink('contract-1', PUBLISHED, signature)).toBe(true)
  })

  it('retires a link once the contract is republished', () => {
    const signature = signContractLink('contract-1', PUBLISHED)
    const republished = new Date('2026-09-15T09:00:00.000Z')

    expect(verifyContractLink('contract-1', republished, signature)).toBe(false)
  })

  it('refuses every link to a contract that is not published', () => {
    const signature = signContractLink('contract-1', PUBLISHED)

    expect(verifyContractLink('contract-1', null, signature)).toBe(false)
  })

  it('refuses a signature moved onto another contract, or a truncated one', () => {
    const signature = signContractLink('contract-1', PUBLISHED)

    expect(verifyContractLink('contract-2', PUBLISHED, signature)).toBe(false)
    expect(verifyContractLink('contract-1', PUBLISHED, signature.slice(0, -2))).toBe(false)
  })

  it('builds the link a client opens, with the origin and the /app basePath', () => {
    const url = clientContractUrl('contract-1', PUBLISHED)

    expect(url).toBe(
      `https://portal.ihp.test/app/contract/contract-1/${signContractLink('contract-1', PUBLISHED)}`,
    )
  })
})
