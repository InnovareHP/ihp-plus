import { describe, expect, it } from 'vitest'
import { renderEmail } from './layout'
import {
  clientOwnerAssignedTemplate,
  clockInReminderTemplate,
  clockOutReminderTemplate,
  contractStatusChangedTemplate,
  evaluationCancelledTemplate,
  evaluationSubmittedTemplate,
  invitationTemplate,
  memberAccessChangedTemplate,
  memberJoinedTemplate,
  memberRoleChangedTemplate,
  requestDecidedTemplate,
  requestReceivedTemplate,
  requestSubmittedTemplate,
  requestWithdrawnTemplate,
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

describe('request receipts', () => {
  it('names who has the request, so the requester knows who to chase', () => {
    const email = requestReceivedTemplate({
      formName: 'Time off',
      teamName: 'Revenue Cycle',
      approverCount: 2,
      asAdmin: false,
      url: 'https://ihp.test/app/requests/view/sub-1',
    })

    expect(email.subject).toBe('Your Time off request is in')
    expect(email.text).toContain('The 2 approvers for Revenue Cycle have it.')
    expect(email.text).toContain('withdraw it yourself')
  })

  it('says an admin will decide when the department has no approver', () => {
    const email = requestReceivedTemplate({
      formName: 'Time off',
      teamName: 'Revenue Cycle',
      approverCount: 3,
      asAdmin: true,
      url: 'https://ihp.test/app/requests/view/sub-1',
    })

    expect(email.text).toContain('has no approver appointed')
  })

  it('tells an approver a withdrawn request needs nothing from them', () => {
    const email = requestWithdrawnTemplate({
      requesterName: 'Grace Hopper',
      formName: 'Time off',
      teamName: 'Revenue Cycle',
      url: 'https://ihp.test/app/requests/view/sub-1',
    })

    expect(email.subject).toBe('Grace Hopper withdrew their Time off request')
    expect(email.text).toContain('nothing left to decide')
  })
})

describe('evaluation emails', () => {
  it('reports a submitted evaluation to whoever asked for it', () => {
    const email = evaluationSubmittedTemplate({
      evaluatorName: 'Ada Lovelace',
      employeeName: 'Grace Hopper',
      formName: 'Annual review',
      url: 'https://ihp.test/app/evaluations/view/ev-1',
    })

    expect(email.subject).toBe('Ada Lovelace submitted the Annual review for Grace Hopper')
    expect(email.text).toContain('https://ihp.test/app/evaluations/view/ev-1')
  })

  it('tells the evaluator a cancelled evaluation kept nothing they typed', () => {
    const email = evaluationCancelledTemplate({
      formName: 'Annual review',
      employeeName: 'Grace Hopper',
      cancelledByName: 'Ada Lovelace',
      url: 'https://ihp.test/app/evaluations',
    })

    expect(email.subject).toBe('The Annual review for Grace Hopper was cancelled')
    expect(email.text).toContain('was not kept')
  })
})

describe('member emails', () => {
  it('names the new role and who set it', () => {
    const email = memberRoleChangedTemplate({
      organizationName: 'Innovare Health Partners',
      scope: 'organization',
      roleLabel: 'Admin',
      changedByName: 'Ada Lovelace',
      url: 'https://ihp.test/app/',
    })

    expect(email.subject).toBe('Your role in Innovare Health Partners changed')
    expect(email.text).toContain('Ada Lovelace')
    expect(email.text).toContain('Admin')
  })

  it('offers no sign-in button to somebody who was just suspended', () => {
    const email = memberAccessChangedTemplate({
      organizationName: 'Innovare Health Partners',
      suspended: true,
      changedByName: 'Ada Lovelace',
      url: 'https://ihp.test/app/login',
    })

    expect(email.subject).toBe('Your Innovare Health Partners access was suspended')
    expect(email.text).not.toContain('https://ihp.test/app/login')
    expect(email.text).toContain('Nothing you filed has been deleted.')
  })

  it('tells the admins who joined and where they landed', () => {
    const email = memberJoinedTemplate({
      memberName: 'Grace Hopper',
      teamName: 'Revenue Cycle',
      jobTitle: 'Billing Specialist',
      url: 'https://ihp.test/app/organization?tab=members',
    })

    expect(email.subject).toBe('Grace Hopper finished setting up their account')
    expect(email.text).toContain('joined Revenue Cycle as Billing Specialist')
  })
})

describe('client and contract emails', () => {
  it('tells a new account owner what came to them', () => {
    const email = clientOwnerAssignedTemplate({
      clientName: 'Riverside Care Center',
      assignedByName: 'Ada Lovelace',
      url: 'https://ihp.test/app/clients',
    })

    expect(email.subject).toBe('You are the account owner for Riverside Care Center')
    expect(email.text).toContain('Ada Lovelace')
  })

  it('names the contract, the client and the new status', () => {
    const email = contractStatusChangedTemplate({
      reference: 'IHP-2026-014',
      title: 'Growth retainer',
      clientName: 'Riverside Care Center',
      statusLabel: 'cancelled',
      changedByName: 'Ada Lovelace',
      url: 'https://ihp.test/app/clients?tab=contracts',
    })

    expect(email.subject).toBe('IHP-2026-014 is now cancelled')
    expect(email.text).toContain('Growth retainer for Riverside Care Center')
  })
})

describe('time clock reminders', () => {
  it('says when the shift started and where to clock in', () => {
    const email = clockInReminderTemplate({
      firstName: 'Grace',
      shiftName: 'Morning',
      startsAt: '09:00',
      url: 'https://ihp.test/app/attendance',
    })

    expect(email.subject).toBe('You have not clocked in yet')
    expect(email.text).toContain('Your Morning shift started at 09:00')
    expect(email.text).toContain('time off request')
    expect(email.text).toContain('https://ihp.test/app/attendance')
  })

  it('warns when the clock will close the day on its own', () => {
    const email = clockOutReminderTemplate({
      firstName: 'Grace',
      shiftName: 'Morning',
      endedAt: '18:00',
      closesAt: '01:00',
      url: 'https://ihp.test/app/attendance',
    })

    expect(email.subject).toBe('You are still clocked in')
    expect(email.text).toContain('closes the day at 01:00')
  })

  it('leaves the auto-close out when the shift never closes a day', () => {
    const email = clockOutReminderTemplate({
      firstName: 'Grace',
      shiftName: 'Night',
      endedAt: '06:00',
      closesAt: undefined,
      url: 'https://ihp.test/app/attendance',
    })

    expect(email.text).not.toContain('closes the day')
  })
})
