import { writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import {
  clientFolderSharedTemplate,
  invitationTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './templates'

// Not an assertion — a way to open the real rendered mail in a browser while working on it.
describe.skipIf(!process.env.EMAIL_PREVIEW_OUT)('email preview', () => {
  it('writes every template to one page', () => {
    const emails = [
      verifyEmailTemplate({ url: 'http://localhost:3000/app/verify?token=abc&next=/app' }),
      resetPasswordTemplate({ url: 'http://localhost:3000/app/reset-password?token=xyz' }),
      invitationTemplate({
        organizationName: 'Innovare Health Partners',
        inviterName: 'lhanivor V. Glorisoso',
        url: 'http://localhost:3000/app/accept-invitation/inv_123',
      }),
      clientFolderSharedTemplate({
        organizationName: 'Innovare Health Partners',
        clientName: 'Acme Clinic',
        email: 'owner@acme.test',
        url: 'https://innovare.sharepoint.com/sites/clients/Acme%20Clinic',
      }),
    ]

    writeFileSync(
      process.env.EMAIL_PREVIEW_OUT!,
      emails.map((email) => email.html).join('<hr style="margin:0;border:0">'),
    )
  })
})
