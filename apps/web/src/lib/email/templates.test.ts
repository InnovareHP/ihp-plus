import { describe, expect, it } from 'vitest'
import { renderEmail } from './layout'
import {
  invitationTemplate,
  requestDecidedTemplate,
  requestSubmittedTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './templates'

describe('request emails', () => {
  it('tells an admin why a request reached them instead of an approver', () => {
    const email = requestSubmittedTemplate({
      requesterName: 'Grace Hopper',
      formName: 'Time off',
      teamName: 'Revenue Cycle',
      asAdmin: true,
      url: 'https://ihp.test/app/requests/view/sub-1',
    })

    expect(email.subject).toBe('Grace Hopper raised a Time off request')
    expect(email.text).toContain('has no approver appointed')
    expect(email.text).toContain('https://ihp.test/app/requests/view/sub-1')
  })

  it('carries the reason for a rejection and what to do next', () => {
    const email = requestDecidedTemplate({
      formName: 'Time off',
      decision: 'rejected',
      deciderName: 'Ada Lovelace',
      note: 'Those dates overlap the audit.',
      url: 'https://ihp.test/app/requests/view/sub-1',
    })

    expect(email.subject).toBe('Your Time off request was not approved')
    expect(email.text).toContain('Their note: Those dates overlap the audit.')
    expect(email.text).toContain('raise the request again')
  })
})

describe('renderEmail', () => {
  it('carries both parts, since HTML alone is a spam signal and unreadable in a text client', () => {
    const email = renderEmail({
      preheader: 'Preview line',
      heading: 'A heading',
      body: ['First sentence.', 'Second sentence.'],
    })

    expect(email.html).toContain('A heading')
    expect(email.text).toContain('First sentence.')
    expect(email.text).toContain('Second sentence.')
  })

  it('escapes an ampersand in the link, which would otherwise close the href early', () => {
    const url = 'https://ihp.test/accept?token=abc&next=/app'
    const email = renderEmail({
      preheader: 'p',
      heading: 'h',
      body: [],
      action: { label: 'Accept', url },
    })

    expect(email.html).toContain('token=abc&amp;next=/app')
    expect(email.html).not.toContain('token=abc&next=')
    // The plain part is not markup, so it carries the URL as typed.
    expect(email.text).toContain(url)
  })

  it('escapes markup in a value rather than rendering it', () => {
    const email = renderEmail({
      preheader: 'p',
      heading: '<script>alert(1)</script>',
      body: ['Tom & Jerry said "hello"'],
    })

    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).not.toContain('<script>alert')
    expect(email.html).toContain('Tom &amp; Jerry')
  })

  it('hides the preheader from the body while leaving it for the inbox preview', () => {
    const email = renderEmail({ preheader: 'Peek at this', heading: 'h', body: [] })

    expect(email.html).toContain('Peek at this')
    expect(email.html).toContain('display:none')
  })

  it('offers the raw link as well as the button, for a client that strips the button', () => {
    const email = renderEmail({
      preheader: 'p',
      heading: 'h',
      body: [],
      action: { label: 'Go', url: 'https://ihp.test/x' },
    })

    expect(email.html).toContain('paste this into your browser')
    expect(email.text).toContain('Go: https://ihp.test/x')
  })

  it('leaves out the action block entirely when there is nothing to click', () => {
    const email = renderEmail({ preheader: 'p', heading: 'h', body: ['Just telling you.'] })

    expect(email.html).not.toContain('paste this into your browser')
  })
})

describe('templates', () => {
  it('names the organization and the inviter in the invitation', () => {
    const email = invitationTemplate({
      organizationName: 'Innovare Health Partners',
      inviterName: 'Ada Lovelace',
      url: 'https://ihp.test/invite/1',
    })

    expect(email.subject).toBe('Join Innovare Health Partners on IHP Plus')
    expect(email.text).toContain('Ada Lovelace invited you to Innovare Health Partners')
  })

  it('tells a password-reset reader that ignoring it is safe', () => {
    const email = resetPasswordTemplate({ url: 'https://ihp.test/reset/1' })

    expect(email.text).toMatch(/did not ask for this/)
    expect(email.html).toContain('https://ihp.test/reset/1')
  })

  it('tells a verification reader what confirming buys them', () => {
    const email = verifyEmailTemplate({ url: 'https://ihp.test/verify/1' })

    expect(email.subject).toBe('Confirm your email address')
    expect(email.text).toContain('password resets')
  })

  it('brands every message the same way', () => {
    for (const email of [
      verifyEmailTemplate({ url: 'https://ihp.test/a' }),
      resetPasswordTemplate({ url: 'https://ihp.test/b' }),
      invitationTemplate({ organizationName: 'Org', inviterName: 'Someone', url: 'x' }),
    ]) {
      expect(email.html).toContain('IHP Plus')
      // The brand hex is the sRGB form of the theme's shade 6.
      expect(email.html).toContain('#1346c5')
      expect(email.text).toContain('Innovare Health Partners')
    }
  })
})
