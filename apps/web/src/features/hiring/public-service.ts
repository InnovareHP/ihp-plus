import { db } from '@ihp/db'
import type { Prisma } from '@ihp/db'
import { z } from 'zod'
import { soleOrganizationId } from '@/lib/organization'
import { consumeRateLimit } from '@/lib/rate-limit'
import { putObject, S3NotConfiguredError } from '@/lib/s3'
import { fileProblem } from '@/features/bluebook/schema'
import {
  answerSchemaOf,
  pruneAnswers,
  type FormField,
  type RequestValues,
  type UploadedFile,
} from '@/features/requests/schema'
import { firstNameOf, notifyApplicationReceived } from './notifications'
import {
  contactSchemaOf,
  ENTRY_STAGE_ID,
  RESUME_FIELD_ID,
  type ActionResult,
  type ApplicationStatus,
  type ApplicationStatusView,
  type CareersPage,
  type EmploymentType,
  type PublicPosting,
  type SalaryPeriod,
  type Workplace,
} from './schema'
import { fieldsOf, stagesOf } from './utils/records'
import { statusPath, statusUrl, verifyStatusLink } from './status-link'

// Everything here is session-free on purpose: this is the careers site, and the signed status
// link is the only credential an applicant ever holds.

export interface PublicRequest {
  ip: string
}

const DAY_MS = 24 * 60 * 60 * 1000
// Long enough to fill in a long form after uploading a resume, short enough to sweep strays.
const UPLOAD_CLAIM_WINDOW_MS = DAY_MS
const UPLOAD_LIMIT = { window: 10 * 60, max: 20 }
const APPLY_LIMIT = { window: 10 * 60, max: 5 }
const TOO_MANY = 'Too many attempts from your connection — wait a few minutes and try again.'
const NOT_TAKING = 'This role is no longer taking applications.'
const FILE_GONE = 'A file you attached is no longer there — upload it again.'
const NO_STORAGE = 'We cannot take files right now — try again later.'

const POSTING_INCLUDE = {
  applicationForm: { select: { fields: true } },
} satisfies Prisma.JobPostingInclude

type PostingRecord = Prisma.JobPostingGetPayload<{ include: typeof POSTING_INCLUDE }>

// A closing date is the last day applications are taken, through to its very end.
function isTakingApplications(
  posting: { status: string; closesAt: Date | null },
  now = new Date(),
) {
  if (posting.status !== 'open') return false
  return !posting.closesAt || posting.closesAt.getTime() + DAY_MS > now.getTime()
}

async function organizationName(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return organization?.name ?? 'IHP+'
}

async function teamNames(organizationId: string, teamIds: readonly (string | null)[]) {
  const ids = teamIds.filter((id): id is string => Boolean(id))
  if (ids.length === 0) return new Map<string, string>()
  const teams = await db.team.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true, name: true },
  })
  return new Map(teams.map((team) => [team.id, team.name]))
}

function publicPostingOf(row: PostingRecord, names: Map<string, string>): PublicPosting {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    location: row.location,
    workplace: row.workplace as Workplace,
    employmentType: row.employmentType as EmploymentType,
    salaryMin: row.salaryMin ?? undefined,
    salaryMax: row.salaryMax ?? undefined,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod as SalaryPeriod,
    teamName: row.teamId ? names.get(row.teamId) : undefined,
    openedAt: row.openedAt?.toISOString(),
    closesAt: row.closesAt?.toISOString(),
    resumeRequired: row.resumeRequired,
    applicationFields: row.applicationForm ? fieldsOf(row.applicationForm.fields) : [],
    isOpen: isTakingApplications(row),
  }
}

export async function loadCareers(): Promise<CareersPage | null> {
  const organizationId = await soleOrganizationId()
  if (!organizationId) return null

  const rows = await db.jobPosting.findMany({
    where: { organizationId, status: 'open' },
    orderBy: [{ openedAt: 'desc' }, { title: 'asc' }],
    include: POSTING_INCLUDE,
  })
  const [names, name] = await Promise.all([
    teamNames(
      organizationId,
      rows.map((row) => row.teamId),
    ),
    organizationName(organizationId),
  ])

  return {
    organizationName: name,
    // Past its closing date means off the list, even before anyone closes it by hand.
    postings: rows.map((row) => publicPostingOf(row, names)).filter((posting) => posting.isOpen),
  }
}

async function findPublicPosting(slug: string) {
  const organizationId = await soleOrganizationId()
  if (!organizationId) return null

  // A draft or an archived posting is not public, so its slug answers exactly like a typo.
  const row = await db.jobPosting.findFirst({
    where: { organizationId, slug, status: { in: ['open', 'closed'] } },
    include: POSTING_INCLUDE,
  })
  return row ? { organizationId, row } : null
}

export async function loadPublicPosting(slug: string) {
  const found = await findPublicPosting(slug)
  if (!found) return null

  const [names, name] = await Promise.all([
    teamNames(found.organizationId, [found.row.teamId]),
    organizationName(found.organizationId),
  ])
  return { organizationName: name, posting: publicPostingOf(found.row, names) }
}

function fileQuestionIds(fields: readonly FormField[]) {
  return new Set([
    RESUME_FIELD_ID,
    ...fields.filter((field) => field.type === 'file').map((field) => field.id),
  ])
}

/** A safe object key: the original name is kept for the download, not for storage. */
function keyFor(organizationId: string, postingId: string, fileName: string) {
  const safe = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
  return `hiring/${organizationId}/${postingId}/${crypto.randomUUID()}-${safe.slice(-80)}`
}

/** Stored unclaimed; sending the application is what attaches it. */
export async function storeApplicationFile(
  input: { slug: string; fieldId: string; file: unknown },
  request: PublicRequest,
): Promise<ActionResult<UploadedFile>> {
  const limit = await consumeRateLimit(`hiring:upload:${request.ip}`, UPLOAD_LIMIT)
  if (!limit.allowed) return { ok: false, message: TOO_MANY }

  if (!(input.file instanceof File)) return { ok: false, message: 'Choose a file to upload.' }
  const problem = fileProblem(input.file)
  if (problem) return { ok: false, message: problem }

  const found = await findPublicPosting(input.slug)
  if (!found || !isTakingApplications(found.row)) return { ok: false, message: NOT_TAKING }

  const fields = found.row.applicationForm ? fieldsOf(found.row.applicationForm.fields) : []
  if (!fileQuestionIds(fields).has(input.fieldId)) {
    return { ok: false, message: 'That question does not take a file.' }
  }

  const key = keyFor(found.organizationId, found.row.id, input.file.name)
  try {
    await putObject(key, new Uint8Array(await input.file.arrayBuffer()), input.file.type)
  } catch (error) {
    if (error instanceof S3NotConfiguredError) return { ok: false, message: NO_STORAGE }
    // The applicant gets a plain sentence, so the real cause goes to the log.
    console.error('[hiring] application file upload failed', error)
    return { ok: false, message: 'Could not store that file — try again.' }
  }

  const attachment = await db.applicationAttachment.create({
    data: {
      organizationId: found.organizationId,
      postingId: found.row.id,
      fieldId: input.fieldId,
      fileKey: key,
      fileName: input.file.name,
      contentType: input.file.type,
      fileSize: input.file.size,
    },
    select: { id: true, fileName: true },
  })
  return { ok: true, data: attachment }
}

const submissionShape = z.object({
  slug: z.string().trim().min(1).max(200),
  contact: z.record(z.string(), z.unknown()),
  answers: z.record(z.string(), z.unknown()).default({}),
})

export async function submitApplication(
  input: unknown,
  request: PublicRequest,
): Promise<ActionResult<{ statusPath: string }>> {
  const shape = submissionShape.safeParse(input)
  if (!shape.success) return { ok: false, message: 'Check the form and try again.' }

  // A filled honeypot is a bot; it gets the same plain refusal as anything else malformed.
  if (typeof shape.data.contact.website === 'string' && shape.data.contact.website !== '') {
    console.warn('[hiring] application refused: honeypot filled')
    return { ok: false, message: 'Could not send your application — try again.' }
  }

  const limit = await consumeRateLimit(`hiring:apply:${request.ip}`, APPLY_LIMIT)
  if (!limit.allowed) return { ok: false, message: TOO_MANY }

  const found = await findPublicPosting(shape.data.slug)
  if (!found || !isTakingApplications(found.row)) return { ok: false, message: NOT_TAKING }
  const { organizationId, row: posting } = found

  const fields = posting.applicationForm ? fieldsOf(posting.applicationForm.fields) : []
  // The server is the trust boundary; the applicant's copy of these schemas is for UX only.
  const contactParsed = contactSchemaOf(posting.resumeRequired).safeParse(shape.data.contact)
  const answersParsed = answerSchemaOf(fields).safeParse(shape.data.answers)
  const problem = contactParsed.error ?? answersParsed.error
  if (!contactParsed.success || !answersParsed.success) {
    return { ok: false, message: problem?.issues[0]?.message ?? 'Some answers are not valid.' }
  }
  const contact = contactParsed.data
  const answers = answersParsed.data as RequestValues
  const email = contact.email.toLowerCase()

  const duplicate = await db.jobApplication.findFirst({
    where: { postingId: posting.id, email, status: 'active' },
    select: { id: true },
  })
  if (duplicate) {
    return {
      ok: false,
      message:
        'You have already applied for this role. The link in your confirmation email shows where it stands.',
    }
  }

  const files = await claimableFiles(posting.id, fields, contact.resumeId, answers)
  if (!files.ok) return files

  const stages = stagesOf(posting.stages)
  const entry = stages[0]?.id ?? ENTRY_STAGE_ID
  const now = new Date()

  const created = await db
    .$transaction(async (tx) => {
      const application = await tx.jobApplication.create({
        data: {
          organizationId,
          postingId: posting.id,
          postingTitle: posting.title,
          fullName: contact.fullName,
          email,
          phone: contact.phone,
          fields,
          values: pruneAnswers(fields, files.values),
          stageId: entry,
          stageChangedAt: now,
          consentAt: now,
        },
      })

      if (files.attachmentIds.length > 0) {
        // Still unclaimed is re-checked here, so a double submit cannot attach one file twice.
        const claimed = await tx.applicationAttachment.updateMany({
          where: { id: { in: files.attachmentIds }, applicationId: null },
          data: { applicationId: application.id },
        })
        if (claimed.count !== files.attachmentIds.length) throw new Error(FILE_GONE)
      }

      await tx.applicationEvent.create({
        data: { applicationId: application.id, kind: 'applied', detail: { stageId: entry } },
      })
      return application
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === FILE_GONE) return null
      throw error
    })
  if (!created) return { ok: false, message: FILE_GONE }

  // Not awaited: a slow mail provider must not hold up the applicant's confirmation page.
  void organizationName(organizationId).then((name) =>
    notifyApplicationReceived({
      applicationId: created.id,
      organizationId,
      organizationName: name,
      fullName: created.fullName,
      email: created.email,
      postingTitle: created.postingTitle,
      statusUrl: statusUrl(created.id, created.createdAt),
    }),
  )

  return { ok: true, data: { statusPath: statusPath(created.id, created.createdAt) } }
}

// A file answer arrives as an upload id and is stored as the file's name, which is what every
// list and detail view then shows.
async function claimableFiles(
  postingId: string,
  fields: readonly FormField[],
  resumeId: string,
  answers: RequestValues,
): Promise<
  { ok: true; values: RequestValues; attachmentIds: string[] } | { ok: false; message: string }
> {
  const values: RequestValues = { ...answers }
  const wanted = new Map<string, string>()
  if (resumeId) wanted.set(resumeId, RESUME_FIELD_ID)
  for (const field of fields) {
    const id = answers[field.id]
    if (field.type === 'file' && typeof id === 'string' && id) wanted.set(id, field.id)
  }
  if (wanted.size === 0) return { ok: true, values, attachmentIds: [] }

  const attachments = await db.applicationAttachment.findMany({
    where: {
      id: { in: [...wanted.keys()] },
      postingId,
      applicationId: null,
      createdAt: { gte: new Date(Date.now() - UPLOAD_CLAIM_WINDOW_MS) },
    },
    select: { id: true, fieldId: true, fileName: true },
  })
  const byId = new Map(attachments.map((attachment) => [attachment.id, attachment]))

  for (const [id, fieldId] of wanted) {
    const attachment = byId.get(id)
    if (!attachment || attachment.fieldId !== fieldId) return { ok: false, message: FILE_GONE }
    if (fieldId !== RESUME_FIELD_ID) values[fieldId] = attachment.fileName
  }
  return { ok: true, values, attachmentIds: [...wanted.keys()] }
}

// The signed link is the applicant's only credential, so every public read and write goes through it.
export async function findByLink(applicationId: string, signature: string) {
  const application = await db.jobApplication.findUnique({
    where: { id: applicationId },
    include: { posting: { select: { slug: true, stages: true } } },
  })
  if (!application || !verifyStatusLink(application.id, application.createdAt, signature)) {
    return null
  }
  return application
}

export async function loadApplicationStatus(
  applicationId: string,
  signature: string,
): Promise<ApplicationStatusView | null> {
  const application = await findByLink(applicationId, signature)
  if (!application) return null

  const stage = stagesOf(application.posting.stages).find(
    (candidate) => candidate.id === application.stageId,
  )
  return {
    id: application.id,
    firstName: firstNameOf(application.fullName),
    postingTitle: application.postingTitle,
    postingSlug: application.posting.slug,
    organizationName: await organizationName(application.organizationId),
    status: application.status as ApplicationStatus,
    stageName: stage?.name ?? 'Under review',
    appliedAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  }
}

export async function withdrawApplication(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ applicationId: z.string().min(1).max(100), signature: z.string().min(1).max(200) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That link is not valid.' }

  const application = await findByLink(parsed.data.applicationId, parsed.data.signature)
  if (!application) return { ok: false, message: 'That link is not valid.' }
  if (application.status !== 'active') {
    return {
      ok: false,
      message: 'This application has already been decided, so it cannot be withdrawn.',
    }
  }

  await db.$transaction([
    db.jobApplication.update({
      where: { id: application.id },
      data: { status: 'withdrawn', decidedAt: new Date() },
    }),
    db.applicationEvent.create({
      data: { applicationId: application.id, kind: 'withdrawn', detail: {} },
    }),
  ])
  return { ok: true, data: undefined }
}
