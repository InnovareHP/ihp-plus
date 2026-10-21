import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openUploadSession, sealUploadSession } from './upload-session'

const SESSION = {
  uploadUrl: 'https://tenant.sharepoint.com/upload?tempauth=secret',
  userId: 'user-1',
  path: 'Clients',
  size: 10,
  expiresAt: 2_000,
}

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'a-test-secret-that-is-long-enough-to-seal')
})

describe('upload session tokens', () => {
  it('round-trips without the upload URL readable in the token', () => {
    const token = sealUploadSession(SESSION)

    expect(Buffer.from(token, 'base64url').toString('latin1')).not.toContain('sharepoint')
    expect(openUploadSession(token, 1_000)).toEqual(SESSION)
  })

  it('refuses an expired, altered, or differently keyed token', () => {
    const token = sealUploadSession(SESSION)

    expect(openUploadSession(token, 2_000)).toBeUndefined()
    // The first character is random, so a fixed "A" left about 1 token in 64 unaltered.
    const altered = `${token.startsWith('A') ? 'B' : 'A'}${token.slice(1)}`
    expect(openUploadSession(altered, 1_000)).toBeUndefined()
    vi.stubEnv('BETTER_AUTH_SECRET', 'another-secret-entirely-also-long-enough')
    expect(openUploadSession(token, 1_000)).toBeUndefined()
  })
})
