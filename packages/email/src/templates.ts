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
  /** A guest share asks for a Microsoft sign-in; a link share opens straight away. */
  requiresSignIn?: boolean
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
        options.requiresSignIn === false
          ? 'The link opens without a sign-in, so keep it to yourself — anyone who has it can read the folder.'
          : 'Open it with this email address. No Microsoft account? Microsoft emails you a one-time code instead of asking for a password. If the link does not work, ask your contact to share the folder again.',
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

export function taskMentionTemplate(options: {
  authorName: string
  taskNumber: number
  taskName: string
  excerpt: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.authorName} mentioned you on #${options.taskNumber} ${options.taskName}`,
    ...renderEmail({
      preheader: `${options.authorName} asked for you on a task.`,
      heading: `${options.authorName} mentioned you`,
      body: [
        `On #${options.taskNumber} ${options.taskName}:`,
        options.excerpt,
        'Reply on the task so the answer stays with the work.',
      ],
      action: { label: 'Open the task', url: options.url },
    }),
  }
}

export function taskCommentTemplate(options: {
  authorName: string
  taskNumber: number
  taskName: string
  excerpt: string
  url: string
}): PreparedEmail {
  return {
    subject: `New comment on #${options.taskNumber} ${options.taskName}`,
    ...renderEmail({
      preheader: `${options.authorName} commented on a task you are on.`,
      heading: `${options.authorName} commented`,
      body: [`On #${options.taskNumber} ${options.taskName}:`, options.excerpt],
      action: { label: 'Open the task', url: options.url },
      footnote: 'You are getting this because you are assigned to this task or have replied on it.',
    }),
  }
}

export function requestReceivedTemplate(options: {
  formName: string
  teamName: string
  /** How many people can decide it; 0 with asAdmin true means the admins were asked. */
  approverCount: number
  asAdmin: boolean
  url: string
}): PreparedEmail {
  const waiting = options.asAdmin
    ? `${options.teamName} has no approver appointed, so an admin will decide it.`
    : options.approverCount === 1
      ? `The approver for ${options.teamName} has it.`
      : `The ${options.approverCount} approvers for ${options.teamName} have it.`

  return {
    subject: `Your ${options.formName} request is in`,
    ...renderEmail({
      preheader: `Your ${options.formName} request is waiting for a decision.`,
      heading: `Your ${options.formName} request is in`,
      body: [`We have it, and it is waiting for a decision.`, waiting],
      action: { label: 'Track the request', url: options.url },
      footnote: 'You can withdraw it yourself until somebody decides it.',
    }),
  }
}

export function requestWithdrawnTemplate(options: {
  requesterName: string
  formName: string
  teamName: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.requesterName} withdrew their ${options.formName} request`,
    ...renderEmail({
      preheader: `Nothing is waiting on you for this ${options.formName} request any more.`,
      heading: `${options.requesterName} withdrew a request`,
      body: [
        `${options.requesterName} withdrew the ${options.formName} request they raised in ${options.teamName}.`,
        'There is nothing left to decide on it.',
      ],
      action: { label: 'Open the request', url: options.url },
    }),
  }
}

export function evaluationSubmittedTemplate(options: {
  evaluatorName: string
  employeeName: string
  formName: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.evaluatorName} submitted the ${options.formName} for ${options.employeeName}`,
    ...renderEmail({
      preheader: `The ${options.formName} for ${options.employeeName} is filled in.`,
      heading: 'An evaluation came back',
      body: [
        `${options.evaluatorName} filled in the ${options.formName} form for ${options.employeeName}.`,
        'What they submitted is the record — nobody has to approve it.',
      ],
      action: { label: 'Read the evaluation', url: options.url },
    }),
  }
}

export function evaluationCancelledTemplate(options: {
  formName: string
  employeeName: string
  cancelledByName: string
  url: string
}): PreparedEmail {
  return {
    subject: `The ${options.formName} for ${options.employeeName} was cancelled`,
    ...renderEmail({
      preheader: `You no longer have to fill in the ${options.formName} for ${options.employeeName}.`,
      heading: 'An evaluation was cancelled',
      body: [
        `${options.cancelledByName} cancelled the ${options.formName} form you were asked to fill in for ${options.employeeName}.`,
        'Anything you had typed was not kept, so there is nothing to finish.',
      ],
      action: { label: 'Open your evaluations', url: options.url },
    }),
  }
}

export function memberRoleChangedTemplate(options: {
  organizationName: string
  /** The organization role decides what they manage; the portal role decides admin screens. */
  scope: 'organization' | 'portal'
  roleLabel: string
  changedByName: string
  url: string
}): PreparedEmail {
  const what = options.scope === 'organization' ? 'role' : 'portal access'

  return {
    subject: `Your ${what} in ${options.organizationName} changed`,
    ...renderEmail({
      preheader: `${options.changedByName} set your ${what} to ${options.roleLabel}.`,
      heading: `You are now ${options.roleLabel}`,
      body: [
        `${options.changedByName} changed your ${what} in ${options.organizationName} to ${options.roleLabel}.`,
        'What the portal offers you changes the next time you open it.',
      ],
      action: { label: 'Open the portal', url: options.url },
      footnote: 'If that looks wrong, reply to whoever manages your organization.',
    }),
  }
}

export function memberAccessChangedTemplate(options: {
  organizationName: string
  suspended: boolean
  changedByName: string
  url: string
}): PreparedEmail {
  if (options.suspended) {
    return {
      subject: `Your ${options.organizationName} access was suspended`,
      ...renderEmail({
        preheader: `You cannot sign in to ${options.organizationName} on IHP Plus for now.`,
        heading: 'Your access was suspended',
        body: [
          `${options.changedByName} suspended your access to ${options.organizationName} on IHP Plus.`,
          'Signing in will not work until somebody restores it. Nothing you filed has been deleted.',
        ],
        footnote: 'If you think this is a mistake, contact whoever manages your organization.',
      }),
    }
  }

  return {
    subject: `Your ${options.organizationName} access is back`,
    ...renderEmail({
      preheader: `You can sign in to ${options.organizationName} on IHP Plus again.`,
      heading: 'Your access is back',
      body: [
        `${options.changedByName} restored your access to ${options.organizationName} on IHP Plus.`,
        'Everything you had before is where you left it.',
      ],
      action: { label: 'Sign in', url: options.url },
    }),
  }
}

export function memberJoinedTemplate(options: {
  memberName: string
  teamName: string
  jobTitle: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.memberName} finished setting up their account`,
    ...renderEmail({
      preheader: `${options.memberName} joined ${options.teamName} as ${options.jobTitle}.`,
      heading: `${options.memberName} is set up`,
      body: [
        `${options.memberName} finished onboarding and joined ${options.teamName} as ${options.jobTitle}.`,
        'Check their role and department are right, and give them whatever they need to start.',
      ],
      action: { label: 'Open members', url: options.url },
    }),
  }
}

export function clientOwnerAssignedTemplate(options: {
  clientName: string
  assignedByName: string
  url: string
}): PreparedEmail {
  return {
    subject: `You are the account owner for ${options.clientName}`,
    ...renderEmail({
      preheader: `${options.assignedByName} made you the account owner for ${options.clientName}.`,
      heading: `${options.clientName} is yours`,
      body: [
        `${options.assignedByName} made you the account owner for ${options.clientName}.`,
        'Their contracts, documents and follow-ups come to you from here.',
      ],
      action: { label: 'Open the client', url: options.url },
    }),
  }
}

export function contractStatusChangedTemplate(options: {
  reference: string
  title: string
  clientName: string
  statusLabel: string
  changedByName: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.reference} is now ${options.statusLabel}`,
    ...renderEmail({
      preheader: `${options.changedByName} set ${options.reference} to ${options.statusLabel}.`,
      heading: `${options.reference} is now ${options.statusLabel}`,
      body: [
        `${options.changedByName} moved ${options.title} for ${options.clientName} to ${options.statusLabel}.`,
        'You own this contract, so the change is yours to know about.',
      ],
      action: { label: 'Open contracts', url: options.url },
    }),
  }
}

export function clockInReminderTemplate(options: {
  firstName: string
  shiftName: string
  /** The shift's start as the person reads it, "09:00". */
  startsAt: string
  url: string
}): PreparedEmail {
  return {
    subject: 'You have not clocked in yet',
    ...renderEmail({
      preheader: `Your ${options.shiftName} shift started at ${options.startsAt}.`,
      heading: `Hi ${options.firstName}, you have not clocked in yet`,
      body: [
        `Your ${options.shiftName} shift started at ${options.startsAt} and there is no clock-in for today.`,
        'If you are working, clock in now so your hours count from here.',
      ],
      action: { label: 'Open your time clock', url: options.url },
      footnote:
        'If you are off today, ask your admin to record it, or raise a time off request so it shows as leave.',
    }),
  }
}

export function clockOutReminderTemplate(options: {
  firstName: string
  shiftName: string
  /** The shift's end as the person reads it, "18:00". */
  endedAt: string
  /** When the clock will close the day on its own, "01:00", or undefined if it never does. */
  closesAt: string | undefined
  url: string
}): PreparedEmail {
  return {
    subject: 'You are still clocked in',
    ...renderEmail({
      preheader: `Your ${options.shiftName} shift ended at ${options.endedAt}.`,
      heading: `Hi ${options.firstName}, you are still clocked in`,
      body: [
        `Your ${options.shiftName} shift ended at ${options.endedAt}, and your clock is still running.`,
        options.closesAt
          ? `If you have finished, clock out now. Otherwise the clock closes the day at ${options.closesAt} and marks the clock-out as missed.`
          : 'If you have finished, clock out now so the day records the hours you actually worked.',
      ],
      action: { label: 'Clock out', url: options.url },
      footnote: 'Still working? Nothing to do; this is the only reminder you will get today.',
    }),
  }
}
