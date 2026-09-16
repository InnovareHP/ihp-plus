import { describe, expect, it } from 'vitest'
import { inviteRedirectUrl } from './invite-redirect'

const MY_APPS = 'https://myapplications.microsoft.com'

describe('inviteRedirectUrl', () => {
  it('keeps an https portal URL', () => {
    expect(inviteRedirectUrl('https://portal.example/app')).toBe('https://portal.example/app')
  })

  it('sends guests to My Apps rather than failing on a dev http URL', () => {
    expect(inviteRedirectUrl('http://localhost:3000/app')).toBe(MY_APPS)
  })

  it('falls back when the value is not a URL at all', () => {
    expect(inviteRedirectUrl('/app')).toBe(MY_APPS)
  })

  it('falls back when nothing is configured', () => {
    expect(inviteRedirectUrl(undefined)).toBe(MY_APPS)
  })
})
