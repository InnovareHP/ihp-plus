import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  jobPosting: { findMany: vi.fn(), findFirst: vi.fn() },
  jobApplication: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  applicationAttachment: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  applicationEvent: { create: vi.fn() },
  organization: { findUnique: vi.fn() },
  team: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))
const rateLimit = vi.hoisted(() => ({ consumeRateLimit: vi.fn() }))
const notifications = vi.hoisted(() => ({
  notifyApplicationReceived: vi.fn(),
  firstNameOf: (name: string) => name.split(' ')[0] ?? name,
}))
const s3 = vi.hoisted(() => ({
  putObject: vi.fn(),
  S3NotConfiguredError: class extends Error {},
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/organization', () => ({ soleOrganizationId: async () => 'org-1' }))
vi.mock('@/lib/rate-limit', () => rateLimit)
vi.mock('@/lib/s3', () => s3)
vi.mock('./notifications', () => notifications)

process.env.BETTER_AUTH_SECRET = 'test-secret'

const {
  loadApplicationStatus,
  loadCareers,
  loadPublicPosting,
  storeApplicationFile,
  submitApplication,
  withdrawApplication,
} = await import('./public-service')
const { signStatusLink } = await import('./status-link')
const { DEFAULT_STAGES } = await import('./schema')

const PORTFOLIO = {
  id: 'portfolio',
  type: 'file',
  label: 'Portfolio',
  help: '',
  placeholder: '',
  required: false,
  options: [],
}
const YEARS = {
  id: 'years',
  type: 'number',
  label: 'Years of experience',
  help: '',
  placeholder: '',
  required: true,
  options: [],
  min: 0,
}

const POSTING = {
  id: 'post-1',
  organizationId: 'org-1',
  teamId: null,
  slug: 'registered-nurse-abc123',
  title: 'Registered nurse',
  summary: '',
  description: 'You will care for patients.',
  location: 'Manila',
  workplace: 'onsite',
  employmentType: 'full_time',
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: 'PHP',
  salaryPeriod: 'month',
  status: 'open',
  resumeRequired: true,
  stages: DEFAULT_STAGES,
  applicationForm: { fields: [YEARS, PORTFOLIO] },
  openedAt: new Date('2026-09-01T00:00:00.000Z'),
  closesAt: null,
}

const CONTACT = {
  fullName: 'Grace Hopper',
  email: 'Grace@Example.com',
  phone: '',
  resumeId: 'file-resume',
  consent: true,
  website: '',
}

const SUBMISSION = {
  slug: POSTING.slug,
  contact: CONTACT,
  answers: { years: 4, portfolio: 'file-portfolio' },
}

const CREATED_AT = new Date('2026-09-20T10:00:00.000Z')
const REQUEST = { ip: '203.0.113.9' }

beforeEach(() => {
  vi.clearAllMocks()
  rateLimit.consumeRateLimit.mockResolvedValue({ allowed: true, retryAfter: null })
  prisma.jobPosting.findFirst.mockResolvedValue(POSTING)
  prisma.organization.findUnique.mockResolvedValue({ name: 'IHP+' })
  prisma.team.findMany.mockResolvedValue([])
  prisma.jobApplication.findFirst.mockResolvedValue(null)
  prisma.applicationAttachment.findMany.mockResolvedValue([
    { id: 'file-resume', fieldId: 'resume', fileName: 'grace-cv.pdf' },
    { id: 'file-portfolio', fieldId: 'portfolio', fileName: 'work.pdf' },
  ])
  prisma.applicationAttachment.updateMany.mockResolvedValue({ count: 2 })
  prisma.jobApplication.create.mockImplementation(async ({ data }) => ({
    id: 'app-1',
    createdAt: CREATED_AT,
    ...data,
  }))
  // The transaction hands back the same mocks, so a write inside one is asserted like any other.
  prisma.$transaction.mockImplementation((run: unknown) =>
    typeof run === 'function' ? run(prisma) : Promise.all(run as Promise<unknown>[]),
  )
})

describe('the careers list', () => {
  it('leaves out a posting past its closing date, even before anyone closes it', async () => {
    prisma.jobPosting.findMany.mockResolvedValue([
      POSTING,
      { ...POSTING, id: 'post-2', slug: 'old-role', closesAt: new Date('2020-01-01T00:00:00Z') },
    ])

    const careers = await loadCareers()

    expect(careers?.postings.map((posting) => posting.slug)).toEqual([POSTING.slug])
    expect(careers?.organizationName).toBe('IHP+')
  })

  it('keeps taking applications through the whole of the closing day', async () => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    prisma.jobPosting.findFirst.mockResolvedValue({ ...POSTING, closesAt: today })

    expect((await loadPublicPosting(POSTING.slug))?.posting.isOpen).toBe(true)
  })

  it('only ever looks up open or closed postings, so a draft answers like a typo', async () => {
    await loadPublicPosting('draft-role')

    expect(prisma.jobPosting.findFirst.mock.calls[0]?.[0].where.status).toEqual({
      in: ['open', 'closed'],
    })
  })
})

describe('applying', () => {
  it('saves the application in the first stage with the files claimed', async () => {
    const result = await submitApplication(SUBMISSION, REQUEST)

    expect(result.ok).toBe(true)
    const data = prisma.jobApplication.create.mock.calls[0]?.[0].data
    expect(data).toMatchObject({
      organizationId: 'org-1',
      postingId: 'post-1',
      email: 'grace@example.com',
      stageId: 'applied',
      // A file answer is stored as the file's name, which every view then shows.
      values: { years: 4, portfolio: 'work.pdf' },
    })
    expect(prisma.applicationAttachment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['file-resume', 'file-portfolio'] }, applicationId: null },
      data: { applicationId: 'app-1' },
    })
    expect(prisma.applicationEvent.create).toHaveBeenCalledWith({
      data: { applicationId: 'app-1', kind: 'applied', detail: { stageId: 'applied' } },
    })
  })

  it('lands the applicant on a status link that verifies', async () => {
    const result = await submitApplication(SUBMISSION, REQUEST)

    expect(result).toEqual({
      ok: true,
      data: { statusPath: `/careers/status/app-1/${signStatusLink('app-1', CREATED_AT)}` },
    })
  })

  it('quietly refuses a filled honeypot without saving anything', async () => {
    const result = await submitApplication(
      { ...SUBMISSION, contact: { ...CONTACT, website: 'https://spam.test' } },
      REQUEST,
    )

    expect(result.ok).toBe(false)
    expect(prisma.jobApplication.create).not.toHaveBeenCalled()
    expect(rateLimit.consumeRateLimit).not.toHaveBeenCalled()
  })

  it('slows down one address sending too many', async () => {
    rateLimit.consumeRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 })

    const result = await submitApplication(SUBMISSION, REQUEST)

    expect(result).toEqual({
      ok: false,
      message: 'Too many attempts from your connection — wait a few minutes and try again.',
    })
    expect(rateLimit.consumeRateLimit).toHaveBeenCalledWith('hiring:apply:203.0.113.9', {
      window: 600,
      max: 5,
    })
  })

  it('refuses a posting that has closed', async () => {
    prisma.jobPosting.findFirst.mockResolvedValue({ ...POSTING, status: 'closed' })

    expect(await submitApplication(SUBMISSION, REQUEST)).toEqual({
      ok: false,
      message: 'This role is no longer taking applications.',
    })
  })

  it('says which answer is wrong, checked on the server', async () => {
    const withoutResume = await submitApplication(
      { ...SUBMISSION, contact: { ...CONTACT, resumeId: '' } },
      REQUEST,
    )
    expect(withoutResume).toEqual({ ok: false, message: 'Attach your resume.' })

    const withoutConsent = await submitApplication(
      { ...SUBMISSION, contact: { ...CONTACT, consent: false } },
      REQUEST,
    )
    expect(withoutConsent.ok).toBe(false)

    const withoutYears = await submitApplication({ ...SUBMISSION, answers: {} }, REQUEST)
    expect(withoutYears.ok).toBe(false)
    expect(prisma.jobApplication.create).not.toHaveBeenCalled()
  })

  it('does not take a second live application from the same address', async () => {
    prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-0' })

    const result = await submitApplication(SUBMISSION, REQUEST)

    expect(result.ok).toBe(false)
    expect(prisma.jobApplication.findFirst.mock.calls[0]?.[0].where).toEqual({
      postingId: 'post-1',
      email: 'grace@example.com',
      status: 'active',
    })
  })

  it('asks for the file again when an upload cannot be claimed', async () => {
    prisma.applicationAttachment.findMany.mockResolvedValue([
      // Uploaded for another question, so it cannot stand in as the resume.
      { id: 'file-resume', fieldId: 'portfolio', fileName: 'grace-cv.pdf' },
    ])

    expect(await submitApplication(SUBMISSION, REQUEST)).toEqual({
      ok: false,
      message: 'A file you attached is no longer there — upload it again.',
    })
    expect(prisma.jobApplication.create).not.toHaveBeenCalled()
  })

  it('refuses a file sent for a question that does not take one', async () => {
    const result = await storeApplicationFile(
      {
        slug: POSTING.slug,
        fieldId: 'years',
        file: new File(['cv'], 'cv.pdf', { type: 'application/pdf' }),
      },
      REQUEST,
    )

    expect(result).toEqual({ ok: false, message: 'That question does not take a file.' })
    expect(s3.putObject).not.toHaveBeenCalled()
  })

  it('stores a resume unclaimed under the posting', async () => {
    prisma.applicationAttachment.create.mockResolvedValue({ id: 'file-9', fileName: 'cv.pdf' })

    const result = await storeApplicationFile(
      {
        slug: POSTING.slug,
        fieldId: 'resume',
        file: new File(['cv'], 'cv.pdf', { type: 'application/pdf' }),
      },
      REQUEST,
    )

    expect(result).toEqual({ ok: true, data: { id: 'file-9', fileName: 'cv.pdf' } })
    expect(s3.putObject.mock.calls[0]?.[0]).toMatch(/^hiring\/org-1\/post-1\/.+-cv\.pdf$/)
  })
})

describe('the status link', () => {
  const APPLICATION = {
    id: 'app-1',
    organizationId: 'org-1',
    fullName: 'Grace Hopper',
    postingTitle: 'Registered nurse',
    status: 'active',
    stageId: 'interview',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    posting: { slug: POSTING.slug, stages: DEFAULT_STAGES },
  }

  beforeEach(() => {
    prisma.jobApplication.findUnique.mockResolvedValue(APPLICATION)
  })

  it('shows the stage by name to whoever holds the signed link', async () => {
    const view = await loadApplicationStatus('app-1', signStatusLink('app-1', CREATED_AT))

    expect(view).toMatchObject({ firstName: 'Grace', stageName: 'Interview', status: 'active' })
  })

  it('shows nothing for a tampered link', async () => {
    expect(await loadApplicationStatus('app-1', 'not-the-signature')).toBeNull()
  })

  it('lets the applicant withdraw, and records it', async () => {
    const result = await withdrawApplication({
      applicationId: 'app-1',
      signature: signStatusLink('app-1', CREATED_AT),
    })

    expect(result.ok).toBe(true)
    expect(prisma.jobApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'withdrawn' }) }),
    )
    expect(prisma.applicationEvent.create).toHaveBeenCalledWith({
      data: { applicationId: 'app-1', kind: 'withdrawn', detail: {} },
    })
  })

  it('will not withdraw one that has already been decided', async () => {
    prisma.jobApplication.findUnique.mockResolvedValue({ ...APPLICATION, status: 'rejected' })

    const result = await withdrawApplication({
      applicationId: 'app-1',
      signature: signStatusLink('app-1', CREATED_AT),
    })

    expect(result.ok).toBe(false)
    expect(prisma.jobApplication.update).not.toHaveBeenCalled()
  })
})
