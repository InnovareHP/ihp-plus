import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  websitesAccess: vi.fn(),
  findFirst: vi.fn(),
  digestGraphic: vi.fn(),
}))

vi.mock('@/features/websites/access', () => ({ websitesAccess: mocks.websitesAccess }))
vi.mock('@ihp/db', () => ({ db: { securityDigestIssue: { findFirst: mocks.findFirst } } }))
vi.mock('@/features/security-digest/graphic', () => ({ digestGraphic: mocks.digestGraphic }))

const { GET } = await import('./route')

const call = (issueId = 'issue-1') =>
  GET(new Request('https://portal.test/api/security-digest/images/x'), {
    params: Promise.resolve({ issueId }),
  })

describe('GET /api/security-digest/images/[issueId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.websitesAccess.mockResolvedValue({ canView: true, organizationId: 'org-1' })
    mocks.findFirst.mockResolvedValue({ topic: 'phishing', title: 'Spot a fake invoice' })
    mocks.digestGraphic.mockResolvedValue(new Response('png', { headers: {} }))
  })

  it('renders the picture for an issue in the viewer’s organization', async () => {
    const response = await call()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'issue-1', organizationId: 'org-1' } }),
    )
    expect(mocks.digestGraphic).toHaveBeenCalledWith({
      topic: 'phishing',
      title: 'Spot a fake invoice',
    })
  })

  it('hides itself from anyone outside IT', async () => {
    mocks.websitesAccess.mockResolvedValue({ canView: false, organizationId: 'org-1' })

    expect((await call()).status).toBe(404)
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('answers 404 for a failed draft with no title', async () => {
    mocks.findFirst.mockResolvedValue({ topic: 'phishing', title: '' })

    expect((await call()).status).toBe(404)
  })
})
