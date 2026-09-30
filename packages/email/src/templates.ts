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
      preheader: 'Confirm your address to finish setting up your account.',
      heading: 'Confirm your email address',
      body: [
        'Confirming your address lets us send you password resets and anything the portal needs you to action.',
      ],
      action: { label: 'Confirm my address', url: options.url },
      footnote: 'If you did not create an account with IHP+, you can ignore this email.',
    }),
  }
}

export function resetPasswordTemplate(options: { url: string }): PreparedEmail {
  return {
    subject: 'Reset your password',
    ...renderEmail({
      preheader: 'Choose a new password for your account.',
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
    subject: `Join ${options.organizationName}`,
    ...renderEmail({
      preheader: `${options.inviterName} invited you to join ${options.organizationName}.`,
      heading: `Join ${options.organizationName}`,
      body: [
        `${options.inviterName} invited you to join ${options.organizationName}.`,
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
  /** The address the folder was shared with, which is the one Microsoft will ask for. */
  email: string
  url: string
  /** A guest share asks for a Microsoft sign-in; a link share opens straight away. */
  requiresSignIn?: boolean
}): PreparedEmail {
  const signIn = options.requiresSignIn !== false

  return {
    subject: `${options.organizationName} shared a document folder with you`,
    ...renderEmail({
      preheader: `Open the folder ${options.organizationName} keeps for ${options.clientName}.`,
      heading: 'Your document folder is ready',
      body: [
        `${options.organizationName} has given you access to the folder it keeps for ${options.clientName}.`,
        'Everything your team files for you appears there, and stays up to date as it changes.',
        ...(signIn
          ? [
              'The folder is kept in Microsoft SharePoint. You do not need a Microsoft account or a password — Microsoft checks it is you with a code sent to this inbox.',
            ]
          : []),
      ],
      ...(signIn
        ? {
            steps: [
              'Select Open the folder below.',
              `When Microsoft asks for your email, enter ${options.email} — the address this message was sent to. Access is tied to it, so another address will not work.`,
              'Select Send code. Microsoft emails a one-time code to that same address; check your junk folder if it has not arrived within a few minutes.',
              'Enter the code within 30 minutes of it arriving. If it has expired, ask Microsoft to send a new one.',
              'The first time, accept the Review permissions screen. The folder then opens, read-only.',
            ],
          }
        : {}),
      action: { label: 'Open the folder', url: options.url },
      footnote: signIn
        ? `Already use ${options.email} for a Microsoft work, school or Outlook account? Microsoft signs you in with that instead of sending a code. Next time, open this email and use the same button; Microsoft asks for a fresh code about once a day. If the link stops working, ask your contact to share the folder again.`
        : 'The link opens without a sign-in, so keep it to yourself — anyone who has it can read the folder.',
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

export function bulletinMentionTemplate(options: {
  authorName: string
  /** True when the mention sits in a reply rather than in the post itself. */
  inReply: boolean
  excerpt: string
  url: string
}): PreparedEmail {
  const where = options.inReply ? 'a reply on the bulletin board' : 'a bulletin board post'

  return {
    subject: `${options.authorName} mentioned you on the bulletin board`,
    ...renderEmail({
      preheader: `${options.authorName} mentioned you in ${where}.`,
      heading: `${options.authorName} mentioned you`,
      body: [`In ${where}:`, options.excerpt],
      action: { label: 'Open the post', url: options.url },
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

// Evaluation mail names nobody: a subject line shows on lock screens and in shared inboxes.
export function evaluationSubmittedTemplate(options: {
  formName: string
  url: string
}): PreparedEmail {
  return {
    subject: 'An evaluation came back',
    ...renderEmail({
      preheader: `A ${options.formName} is ready to read in the portal.`,
      heading: 'An evaluation came back',
      body: [
        `A ${options.formName} form has been filled in. Who it is about is shown once you open it in the portal.`,
        'What was submitted is the record — nobody has to approve it.',
      ],
      action: { label: 'Read the evaluation', url: options.url },
    }),
  }
}

export function evaluationCancelledTemplate(options: {
  formName: string
  url: string
}): PreparedEmail {
  return {
    subject: 'An evaluation was cancelled',
    ...renderEmail({
      preheader: `One of your ${options.formName} evaluations no longer needs filling in.`,
      heading: 'An evaluation was cancelled',
      body: [
        `People & Culture cancelled one of the ${options.formName} forms you were asked to fill in. Your evaluations list shows which.`,
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
        preheader: `You cannot sign in to ${options.organizationName} for now.`,
        heading: 'Your access was suspended',
        body: [
          `${options.changedByName} suspended your access to ${options.organizationName}.`,
          'Signing in will not work until somebody restores it. Nothing you filed has been deleted.',
        ],
        footnote: 'If you think this is a mistake, contact whoever manages your organization.',
      }),
    }
  }

  return {
    subject: `Your ${options.organizationName} access is back`,
    ...renderEmail({
      preheader: `You can sign in to ${options.organizationName} again.`,
      heading: 'Your access is back',
      body: [
        `${options.changedByName} restored your access to ${options.organizationName}.`,
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

export function leaveCancelledTemplate(options: {
  formName: string
  cancellerName: string
  note: string
  url: string
}): PreparedEmail {
  return {
    subject: `Your ${options.formName} was cancelled`,
    ...renderEmail({
      preheader: `${options.cancellerName} cancelled your approved ${options.formName}.`,
      heading: `Your ${options.formName} was cancelled`,
      body: [
        `${options.cancellerName} cancelled the ${options.formName} they had approved, so those days are workdays on your time clock again.`,
        `Their reason: ${options.note}`,
      ],
      action: { label: 'Open the request', url: options.url },
      footnote: 'If you still need the time off, raise a new request with the dates that work now.',
    }),
  }
}

const correctionDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

export function correctionDecidedTemplate(options: {
  /** YYYY-MM-DD. */
  workDate: string
  decision: 'approved' | 'rejected'
  deciderName: string
  note: string | undefined
  url: string
}): PreparedEmail {
  const day = correctionDay.format(new Date(`${options.workDate}T00:00:00Z`))
  const approved = options.decision === 'approved'

  return {
    subject: approved ? `Your ${day} was corrected` : `Your correction for ${day} was turned down`,
    ...renderEmail({
      preheader: `${options.deciderName} ${approved ? 'approved' : 'turned down'} your correction request.`,
      heading: approved
        ? `Your ${day} was corrected`
        : `Your correction for ${day} was turned down`,
      body: [
        approved
          ? `${options.deciderName} approved your request, and the day now reads the way you asked.`
          : `${options.deciderName} turned down your correction request, so the day is unchanged.`,
        ...(options.note ? [`Their note: ${options.note}`] : []),
      ],
      action: { label: 'Open your time clock', url: options.url },
      footnote: approved
        ? undefined
        : 'If something is still wrong with the day, send a new request with what they asked for.',
    }),
  }
}

// HR writes these messages as free text; a blank line is where they meant a new paragraph.
function paragraphsOf(message: string) {
  return message
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
}

export function applicationReceivedTemplate(options: {
  organizationName: string
  firstName: string
  postingTitle: string
  url: string
}): PreparedEmail {
  return {
    subject: `We received your application for ${options.postingTitle}`,
    ...renderEmail({
      preheader: `Thanks for applying to ${options.organizationName}. Here is where to follow it.`,
      heading: `Thanks for applying, ${options.firstName}`,
      body: [
        `Your application for ${options.postingTitle} at ${options.organizationName} is in, and our team will review it.`,
        'You can check where it stands at any time from the link below, and withdraw it there if your plans change.',
      ],
      action: { label: 'Check your application', url: options.url },
      footnote: 'Keep this email: the link is how you get back to your application.',
    }),
  }
}

export function newApplicantTemplate(options: {
  applicantName: string
  postingTitle: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.applicantName} applied for ${options.postingTitle}`,
    ...renderEmail({
      preheader: `A new application is waiting in ${options.postingTitle}.`,
      heading: `New applicant for ${options.postingTitle}`,
      body: [
        `${options.applicantName} applied for ${options.postingTitle}. Their answers and resume are in the portal.`,
      ],
      action: { label: 'Review the application', url: options.url },
      footnote: 'You get this because you run hiring for your organization.',
    }),
  }
}

export function applicationStageTemplate(options: {
  organizationName: string
  firstName: string
  postingTitle: string
  message: string
  url: string
}): PreparedEmail {
  return {
    subject: `An update on your application for ${options.postingTitle}`,
    ...renderEmail({
      preheader: `${options.organizationName} has an update on your application.`,
      heading: `Hi ${options.firstName}`,
      body: paragraphsOf(options.message),
      action: { label: 'Check your application', url: options.url },
      footnote: `Sent by ${options.organizationName} about your application for ${options.postingTitle}.`,
    }),
  }
}

export function applicationRejectedTemplate(options: {
  organizationName: string
  firstName: string
  postingTitle: string
  message: string
}): PreparedEmail {
  return {
    subject: `Your application for ${options.postingTitle}`,
    ...renderEmail({
      preheader: `An update from ${options.organizationName} on your application.`,
      heading: `Hi ${options.firstName}`,
      body: paragraphsOf(options.message),
      footnote: `Sent by ${options.organizationName} about your application for ${options.postingTitle}.`,
    }),
  }
}

export function jobOfferTemplate(options: {
  organizationName: string
  firstName: string
  postingTitle: string
  message: string
  /** True when an earlier offer was declined and this one replaces it. */
  revised: boolean
  hasLetter: boolean
  url: string
}): PreparedEmail {
  return {
    subject: options.revised
      ? `A revised offer for ${options.postingTitle}`
      : `Your offer for ${options.postingTitle}`,
    ...renderEmail({
      preheader: `${options.organizationName} has ${options.revised ? 'sent a revised' : 'made you an'} offer.`,
      heading: `Congratulations, ${options.firstName}`,
      body: [
        ...paragraphsOf(options.message),
        options.hasLetter
          ? 'Your offer letter is on the page below. Read it, then accept or decline the offer there.'
          : 'Accept or decline the offer from the page below.',
      ],
      action: { label: 'Review your offer', url: options.url },
      footnote: `Sent by ${options.organizationName} about your application for ${options.postingTitle}.`,
    }),
  }
}

export function offerAnsweredTemplate(options: {
  applicantName: string
  postingTitle: string
  decision: 'accepted' | 'declined'
  /** Only a decline carries one. */
  reason: string
  url: string
}): PreparedEmail {
  const accepted = options.decision === 'accepted'
  return {
    subject: accepted
      ? `${options.applicantName} accepted the offer for ${options.postingTitle}`
      : `${options.applicantName} declined the offer for ${options.postingTitle}`,
    ...renderEmail({
      preheader: accepted
        ? 'They said yes — hire them to send their portal invitation.'
        : 'They said no. You can send them a revised offer.',
      heading: accepted ? 'Offer accepted' : 'Offer declined',
      body: accepted
        ? [
            `${options.applicantName} accepted your offer for ${options.postingTitle}.`,
            'Hire them from the application to send the invitation that sets up their portal account.',
          ]
        : [
            `${options.applicantName} declined your offer for ${options.postingTitle}.`,
            `Their reason: ${options.reason}`,
            'If you can change the terms, send them a revised offer from the application.',
          ],
      action: { label: 'Open the application', url: options.url },
      footnote: 'You get this because you run hiring for your organization.',
    }),
  }
}

export function interviewOfferedTemplate(options: {
  organizationName: string
  firstName: string
  postingTitle: string
  /** A note HR added to the offer, if any. */
  note: string
  url: string
}): PreparedEmail {
  return {
    subject: `Pick a time for your interview: ${options.postingTitle}`,
    ...renderEmail({
      preheader: `${options.organizationName} would like to interview you.`,
      heading: `Pick a time, ${options.firstName}`,
      body: [
        `${options.organizationName} would like to interview you for ${options.postingTitle}.`,
        ...paragraphsOf(options.note),
        'Choose the time that suits you from the ones offered. Times show in your own time zone.',
      ],
      action: { label: 'Choose a time', url: options.url },
      footnote: 'If none of the times work, say so on the same page and we will offer others.',
    }),
  }
}

export function interviewBookedTemplate(options: {
  organizationName: string
  firstName: string
  postingTitle: string
  /** Already written in the applicant's own time zone, zone name included. */
  when: string
  where: string
  url: string
}): PreparedEmail {
  return {
    subject: `Interview booked: ${options.postingTitle}, ${options.when}`,
    ...renderEmail({
      preheader: `Your interview with ${options.organizationName} is confirmed.`,
      heading: `See you ${options.when}`,
      body: [
        `Your interview for ${options.postingTitle} is booked for ${options.when}.`,
        options.where,
        'The calendar invite is attached, or in your inbox from our calendar.',
      ],
      action: { label: 'See or change your interview', url: options.url },
    }),
  }
}

export function interviewScheduledTemplate(options: {
  applicantName: string
  postingTitle: string
  when: string
  where: string
  url: string
}): PreparedEmail {
  return {
    subject: `Interview: ${options.applicantName}, ${options.when}`,
    ...renderEmail({
      preheader: `${options.applicantName} booked an interview for ${options.postingTitle}.`,
      heading: `Interview with ${options.applicantName}`,
      body: [
        `${options.applicantName} booked ${options.when} for their ${options.postingTitle} interview.`,
        options.where,
        'Their resume and answers are in the portal, and so is the scorecard to fill in afterwards.',
      ],
      action: { label: 'Open the interview', url: options.url },
    }),
  }
}

export function interviewCancelledTemplate(options: {
  organizationName: string
  firstName: string
  postingTitle: string
  when: string
}): PreparedEmail {
  return {
    subject: `Cancelled: interview for ${options.postingTitle}`,
    ...renderEmail({
      preheader: `The interview on ${options.when} will not go ahead.`,
      heading: `Hi ${options.firstName}`,
      body: [
        `The interview for ${options.postingTitle} on ${options.when} has been cancelled.`,
        `${options.organizationName} will be in touch if a new time is needed.`,
      ],
    }),
  }
}

export function interviewReminderTemplate(options: {
  firstName: string
  postingTitle: string
  when: string
  where: string
  url: string
}): PreparedEmail {
  return {
    subject: `Tomorrow: your interview for ${options.postingTitle}`,
    ...renderEmail({
      preheader: `A reminder about your interview, ${options.when}.`,
      heading: `See you soon, ${options.firstName}`,
      body: [
        `A reminder that your interview for ${options.postingTitle} is ${options.when}.`,
        options.where,
      ],
      action: { label: 'See or change your interview', url: options.url },
    }),
  }
}

export function rescheduleRequestedTemplate(options: {
  applicantName: string
  postingTitle: string
  url: string
}): PreparedEmail {
  return {
    subject: `${options.applicantName} needs other interview times`,
    ...renderEmail({
      preheader: `None of the offered times work for ${options.applicantName}.`,
      heading: 'New times needed',
      body: [
        `${options.applicantName} could not make any of the times offered for their ${options.postingTitle} interview.`,
        'Offer a few more from their application.',
      ],
      action: { label: 'Offer new times', url: options.url },
    }),
  }
}

export function scorecardRequestTemplate(options: {
  applicantName: string
  postingTitle: string
  url: string
}): PreparedEmail {
  return {
    subject: `Scorecard: ${options.applicantName}`,
    ...renderEmail({
      preheader: `How did the interview with ${options.applicantName} go?`,
      heading: 'Fill in your scorecard',
      body: [
        `Your interview with ${options.applicantName} for ${options.postingTitle} has ended.`,
        'Record your view while it is fresh; HR decides with every interviewer’s scorecard in front of them.',
      ],
      action: { label: 'Fill in the scorecard', url: options.url },
    }),
  }
}
