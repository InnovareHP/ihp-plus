import { writeFileSync } from 'node:fs'
import { describe, it } from 'vitest'
import { LOGO_CONTENT_ID, LOGO_PNG_BASE64 } from './logo'
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
        organizationName: 'IHP+',
        inviterName: 'lhanivor V. Glorisoso',
        url: 'http://localhost:3000/app/accept-invitation/inv_123',
      }),
      clientFolderSharedTemplate({
        organizationName: 'IHP+',
        clientName: 'Acme Clinic',
        email: 'owner@acme.test',
        url: 'https://innovare.sharepoint.com/sites/clients/Acme%20Clinic',
      }),
    ]

    writeFileSync(
      process.env.EMAIL_PREVIEW_OUT!,
      emails
        .map((email) => email.html)
        .join('<hr style="margin:0;border:0">')
        // A browser cannot resolve a content id, so the preview carries the logo itself.
        .replaceAll(`cid:${LOGO_CONTENT_ID}`, `data:image/png;base64,${LOGO_PNG_BASE64}`),
    )
  })
})
