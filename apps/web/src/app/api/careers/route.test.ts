import { beforeEach, describe, expect, it, vi } from 'vitest'

const service = vi.hoisted(() => ({ loadCareers: vi.fn() }))

vi.mock('@/features/hiring/public-service', () => service)

const { GET } = await import('./route')

const POSTING = {
  slug: 'registered-nurse-abc123',
  title: 'Registered nurse',
  summary: 'Care for patients',
  description: 'Long description the list does not need.',
  location: 'Manila',
  workplace: 'hybrid',
  employmentType: 'full_time',
  salaryMin: 30000,
  salaryMax: 40000,
  salaryCurrency: 'PHP',
  salaryPeriod: 'month',
  teamName: 'Care Management',
  openedAt: '2026-09-01T00:00:00.000Z',
  closesAt: '2026-10-31T00:00:00.000Z',
  resumeRequired: true,
  applicationFields: [],
  isOpen: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BETTER_AUTH_URL', 'https://portal.ihp.test')
})

describe('GET /api/careers', () => {
  it('lists open roles worded for a page, each linking to where people apply', async () => {
    service.loadCareers.mockResolvedValue({ organizationName: 'IHP+', postings: [POSTING] })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.careersUrl).toBe('https://portal.ihp.test/app/careers')
    expect(body.roles).toEqual([
      {
        slug: 'registered-nurse-abc123',
        title: 'Registered nurse',
        summary: 'Care for patients',
        team: 'Care Management',
        employmentType: 'Full time',
        workplace: 'Hybrid',
        location: 'Manila',
        pay: '₱30,000 – ₱40,000 a month',
        closesAt: '2026-10-31T00:00:00.000Z',
        url: 'https://portal.ihp.test/app/careers/registered-nurse-abc123',
      },
    ])
    // Nothing beyond the list: the description and the form stay on the role's own page.
    expect(body.roles[0].description).toBeUndefined()
  })

  it('answers 500 when the list cannot be read, so the site build falls back', async () => {
    service.loadCareers.mockRejectedValue(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await GET()).status).toBe(500)
  })
})
