import { db } from '@ihp/db'
import { Code, ConnectError } from '@ihp/rpc'
import { jobOfferTemplate, offerAnsweredTemplate, portalUrl, sendEmail } from '@/lib/email'
import { applicationRoute } from '@/lib/routes'
import { objectUrl, putObject, S3NotConfiguredError } from '@/lib/s3'
import { requireHiringCaller } from './access'
import { firstNameOf, hiringAdminEmails } from './notifications'
import { offerRecordsOf, publicOfferOf } from './offers'
import { loadApplication } from './pipeline-service'
import { findByLink } from './public-service'
import {
  isOfferStage,
  offerAnswerSchema,
  offerLetterProblem,
  sendOfferSchema,
  type ActionResult,
  type ApplicationDetail,
  type PublicOffer,
} from './schema'
import { statusUrl } from './status-link'
import { stagesOf } from './utils/records'

const BAD_LINK = 'That link is not valid.'

function letterKey(organizationId: string, applicationId: string, fileName: string) {
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
  return `hiring/${organizationId}/offers/${applicationId}/${crypto.randomUUID()}-${safe.slice(-80)}`
}

async function organizationName(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return organization?.name ?? 'IHP+'
}

/**
 * HR sends an offer to someone in the offer stage. A new one is refused while the last is still
 * waiting on an answer, so the applicant only ever has one offer to respond to.
 */
export async function sendOffer(input: {
  applicationId: string
  message: string
  file: unknown
}): Promise<ApplicationDetail> {
  const caller = await requireHiringCaller()
  const parsed = sendOfferSchema.safeParse(input)
  if (!parsed.success) {
    throw new ConnectError(
      parsed.error.issues[0]?.message ?? 'Check the offer and try again.',
      Code.InvalidArgument,
    )
  }
  const values = parsed.data

  const application = await db.jobApplication.findFirst({
    where: { id: values.applicationId, organizationId: caller.organizationId },
    include: { posting: { select: { stages: true } } },
  })
  if (!application) throw new ConnectError('That application no longer exists.', Code.NotFound)
  if (application.status !== 'active') {
    throw new ConnectError(
      'This application has already been decided, so no offer can be sent.',
      Code.FailedPrecondition,
    )
  }
  const stage = stagesOf(application.posting.stages).find(
    (candidate) => candidate.id === application.stageId,
  )
  if (!isOfferStage(stage)) {
    throw new ConnectError('Move them to the offer stage first.', Code.FailedPrecondition)
  }

  const [latest] = await offerRecordsOf(application.id)
  if (latest?.status === 'sent') {
    throw new ConnectError(
      'They have not answered the last offer yet, so a new one cannot be sent.',
      Code.FailedPrecondition,
    )
  }
  if (latest?.status === 'accepted') {
    throw new ConnectError('They already accepted an offer.', Code.FailedPrecondition)
  }

  const file = input.file instanceof File && input.file.size > 0 ? input.file : undefined
  let letter: { fileKey: string; fileName: string; contentType: string; fileSize: number } | null =
    null
  if (file) {
    const problem = offerLetterProblem(file)
    if (problem) throw new ConnectError(problem, Code.InvalidArgument)
    const fileKey = letterKey(caller.organizationId, application.id, file.name)
    try {
      await putObject(fileKey, new Uint8Array(await file.arrayBuffer()), file.type)
    } catch (error) {
      if (error instanceof S3NotConfiguredError) {
        throw new ConnectError(
          'File storage is not configured, so the letter cannot be attached — send the offer without it or ask an admin.',
          Code.FailedPrecondition,
        )
      }
      throw error
    }
    letter = { fileKey, fileName: file.name, contentType: file.type, fileSize: file.size }
  }

  const revised = latest?.status === 'declined'
  await db.$transaction(async (tx) => {
    const offer = await tx.jobOffer.create({
      data: {
        organizationId: caller.organizationId,
        applicationId: application.id,
        createdById: caller.userId,
        message: values.message,
        ...letter,
      },
    })
    await tx.applicationEvent.create({
      data: {
        applicationId: application.id,
        actorId: caller.userId,
        kind: 'offer_sent',
        detail: { offerId: offer.id, revised, emailed: true },
      },
    })
  })

  try {
    void sendEmail({
      to: application.email,
      ...jobOfferTemplate({
        organizationName: await organizationName(caller.organizationId),
        firstName: firstNameOf(application.fullName),
        postingTitle: application.postingTitle,
        message: values.message,
        revised,
        hasLetter: letter !== null,
        url: statusUrl(application.id, application.createdAt),
      }),
    })
  } catch (error) {
    // The offer is saved and shows on their status page, so a mail outage must not undo it.
    console.error(`[hiring] could not email the offer for ${application.id}`, error)
  }

  return loadApplication(application.id)
}

/** The newest offer, which is the only one an applicant sees or can answer. */
export async function loadPublicOffer(applicationId: string): Promise<PublicOffer | undefined> {
  const [latest] = await offerRecordsOf(applicationId)
  return latest ? publicOfferOf(latest) : undefined
}

export async function answerOffer(input: unknown): Promise<ActionResult> {
  const parsed = offerAnswerSchema.safeParse(input)
  if (!parsed.success) {
    const reason = parsed.error.issues.find((issue) => issue.path[0] === 'reason')
    return { ok: false, message: reason?.message ?? BAD_LINK }
  }
  const values = parsed.data

  const application = await findByLink(values.applicationId, values.signature)
  if (!application) return { ok: false, message: BAD_LINK }
  if (application.status !== 'active') {
    return {
      ok: false,
      message: 'This application is closed, so the offer can no longer be answered.',
    }
  }

  const [latest] = await offerRecordsOf(application.id)
  if (!latest || latest.id !== values.offerId) {
    return {
      ok: false,
      message: 'This offer has been replaced — reload the page to see the new one.',
    }
  }

  const accepted = values.decision === 'accept'
  const reason = accepted ? '' : values.reason
  // Conditional on still being sent, so a double click or a second tab cannot answer twice.
  const answered = await db.jobOffer.updateMany({
    where: { id: latest.id, status: 'sent' },
    data: {
      status: accepted ? 'accepted' : 'declined',
      declineReason: accepted ? null : reason,
      respondedAt: new Date(),
    },
  })
  if (answered.count === 0) return { ok: false, message: 'You already answered this offer.' }

  await db.applicationEvent.create({
    data: {
      applicationId: application.id,
      kind: accepted ? 'offer_accepted' : 'offer_declined',
      detail: { offerId: latest.id, reason },
    },
  })

  try {
    const email = offerAnsweredTemplate({
      applicantName: application.fullName,
      postingTitle: application.postingTitle,
      decision: accepted ? 'accepted' : 'declined',
      reason,
      url: portalUrl(applicationRoute(application.id)),
    })
    for (const to of await hiringAdminEmails(application.organizationId)) {
      void sendEmail({ to, ...email })
    }
  } catch (error) {
    console.error(`[hiring] could not tell admins about the answer on ${application.id}`, error)
  }

  return { ok: true, data: undefined }
}

/** HR opening the letter from the portal; interviewers have no business with the terms. */
export async function offerLetterUrl(offerId: string) {
  const caller = await requireHiringCaller()
  const offer = await db.jobOffer.findFirst({
    where: { id: offerId, organizationId: caller.organizationId },
    select: { fileKey: true },
  })
  if (!offer?.fileKey) {
    throw new ConnectError('That letter is no longer there.', Code.NotFound)
  }
  return objectUrl(offer.fileKey)
}

/** The applicant opening their own letter through the signed status link. */
export async function publicOfferLetterUrl(
  applicationId: string,
  signature: string,
  offerId: string,
) {
  const application = await findByLink(applicationId, signature)
  if (!application) return null
  const offer = await db.jobOffer.findFirst({
    where: { id: offerId, applicationId: application.id },
    select: { fileKey: true },
  })
  return offer?.fileKey ? objectUrl(offer.fileKey) : null
}
