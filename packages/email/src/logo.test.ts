import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LOGO_PNG_BASE64 } from './logo'

describe('the email logo', () => {
  it('is the same image as the brand PNG it was generated from', () => {
    const source = readFileSync(
      new URL('../../../apps/landing/public/brand/logo-email.png', import.meta.url),
    )
    expect(LOGO_PNG_BASE64).toBe(source.toString('base64'))
  })
})
