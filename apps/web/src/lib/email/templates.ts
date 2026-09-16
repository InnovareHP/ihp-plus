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

export function clientFolderSharedTemplate(options: {
  organizationName: string
  clientName: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.organizationName} shared a document folder with you`,
    ...renderEmail({
      preheader: `Open the folder ${options.organizationName} keeps for ${options.clientName}.`,
      heading: 'Your document folder is ready',
      body: [
        `${options.organizationName} has given you access to the folder it keeps for ${options.clientName}.`,
        'Everything your team files for you appears there, and stays up to date as it changes.',
      ],
      action: { label: 'Open the folder', url: options.url },
      footnote:
        'Sign in with this email address to open it. If the link does not work, ask your contact to share the folder again.',
    }),
  }
}

const dueDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })

export function evaluationAssignedTemplate(options: {
  formName: string
  count: number
  dueAt: Date | null
  url: string
}): PreparedEmail {
  const people = options.count === 1 ? 'one person' : `${options.count} people`

  return {
    subject:
      options.count === 1
        ? `An ${options.formName} is waiting for you`
        : `${options.count} ${options.formName} evaluations are waiting for you`,
    ...renderEmail({
      preheader: `You have ${people} to evaluate on the ${options.formName} form.`,
      heading: 'An evaluation is waiting for you',
      body: [
        `People & Culture asked you to fill in the ${options.formName} form for ${people}.`,
        options.dueAt
          ? `It is due by ${dueDate.format(options.dueAt)}.`
          : 'There is no due date, so fill it in when you can.',
        'Nobody has to approve it: what you submit is the record.',
      ],
      action: { label: 'Open your evaluations', url: options.url },
    }),
  }
}

export function requestSubmittedTemplate(options: {
  requesterName: string
  formName: string
  teamName: string
  /** True when no approver is appointed, so the admins are being asked instead. */
  asAdmin: boolean
  url: string
}): PreparedEmail {
  return {
    subject: `${options.requesterName} raised a ${options.formName} request`,
    ...renderEmail({
      preheader: `A ${options.formName} request from ${options.teamName} is waiting for a decision.`,
      heading: `New ${options.formName} request`,
      body: [
        `${options.requesterName} raised a ${options.formName} request in ${options.teamName}.`,
        options.asAdmin
          ? `${options.teamName} has no approver appointed, so it is waiting for an admin to decide.`
          : `You approve requests for ${options.teamName}, so it is waiting in your queue.`,
      ],
      action: { label: 'Review the request', url: options.url },
    }),
  }
}

export function requestDecidedTemplate(options: {
  formName: string
  decision: 'approved' | 'rejected'
  deciderName: string
  note: string | undefined
  url: string
}): PreparedEmail {
  const approved = options.decision === 'approved'
  const outcome = approved ? 'approved' : 'not approved'

  return {
    subject: `Your ${options.formName} request was ${outcome}`,
    ...renderEmail({
      preheader: `${options.deciderName} decided your ${options.formName} request.`,
      heading: `Your ${options.formName} request was ${outcome}`,
      body: [
        `${options.deciderName} ${approved ? 'approved' : 'turned down'} your ${options.formName} request.`,
        ...(options.note ? [`Their note: ${options.note}`] : []),
      ],
      action: { label: 'Open the request', url: options.url },
      footnote: approved
        ? undefined
        : 'If something needs changing, raise the request again with what they asked for.',
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
