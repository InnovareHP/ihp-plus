import { renderEmail } from './layout'

export interface PreparedEmail {
  subject: string
  html: string
  text: string
}

/**
 * Every transactional message the portal sends. Kept together so the wording stays one voice
 * and a new message is written beside the others rather than inline at its call site.
 */
export function verifyEmailTemplate(options: { url: string }): PreparedEmail {
  return {
    subject: 'Confirm your email address',
    ...renderEmail({
      preheader: 'Confirm your address to finish setting up your IHP Plus account.',
      heading: 'Confirm your email address',
      body: [
        'Confirming your address lets us send you password resets and anything the portal needs you to action.',
      ],
      action: { label: 'Confirm my address', url: options.url },
      footnote: 'If you did not create an IHP Plus account, you can ignore this email.',
    }),
  }
}

export function resetPasswordTemplate(options: { url: string }): PreparedEmail {
  return {
    subject: 'Reset your IHP Plus password',
    ...renderEmail({
      preheader: 'Choose a new password for your IHP Plus account.',
      heading: 'Choose a new password',
      body: [
        'Use the link below to set a new password. Your current one keeps working until you do.',
      ],
      action: { label: 'Choose a new password', url: options.url },
      footnote:
        'If you did not ask for this, ignore this email and your password stays as it is. The link expires in one hour.',
    }),
  }
}

export function invitationTemplate(options: {
  organizationName: string
  inviterName: string
  url: string
}): PreparedEmail {
  return {
    subject: `Join ${options.organizationName} on IHP Plus`,
    ...renderEmail({
      preheader: `${options.inviterName} invited you to join ${options.organizationName}.`,
      heading: `Join ${options.organizationName}`,
      body: [
        `${options.inviterName} invited you to ${options.organizationName} on IHP Plus.`,
        'Accepting takes you through a short setup — your name, your department and a photo for your company ID.',
      ],
      action: { label: 'Accept the invitation', url: options.url },
      footnote: 'If you were not expecting this, you can ignore it and nothing happens.',
    }),
  }
}

export function contractPublishedTemplate(options: {
  organizationName: string
  reference: string
  title: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.reference}: your contract from ${options.organizationName} is ready`,
    ...renderEmail({
      preheader: `Review ${options.title} and accept it online.`,
      heading: `Review ${options.title}`,
      body: [
        `${options.organizationName} has sent you contract ${options.reference}, ${options.title}, to review.`,
        'It lists the services, the dates and the terms. Accept it online by typing your name; nothing is billed until you do.',
      ],
      action: { label: 'Review the contract', url: options.url },
      footnote:
        'The link works until the contract changes. If it stops working, ask your contact for a new one.',
    }),
  }
}

export function contractAcceptedTemplate(options: {
  clientName: string
  reference: string
  acceptedByName: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.clientName} accepted ${options.reference}`,
    ...renderEmail({
      preheader: `${options.acceptedByName} accepted ${options.reference} online.`,
      heading: `${options.reference} was accepted`,
      body: [
        `${options.acceptedByName} accepted ${options.reference} on behalf of ${options.clientName}.`,
        'The contract is now active. If billing is set up, Stripe has started invoicing them.',
      ],
      action: { label: 'Open contracts', url: options.url },
    }),
  }
}
