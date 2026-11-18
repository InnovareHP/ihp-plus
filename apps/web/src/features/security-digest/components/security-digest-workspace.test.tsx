import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import type { DigestOverview, IssueRow } from '../schema'

const actions = vi.hoisted(() => ({
  getDigestOverview: vi.fn(),
  saveDigestSettings: vi.fn(),
  generateDigestDraft: vi.fn(),
  approveDigestIssue: vi.fn(),
  rejectDigestIssue: vi.fn(),
  sendDigestIssueNow: vi.fn(),
  sendDigestTest: vi.fn(),
}))
const notify = vi.hoisted(() => ({ announceFailure: vi.fn(), announceSuccess: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@/lib/announce', () => notify)
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/security-emails',
  useRouter: () => ({ replace: vi.fn() }),
}))

const { SecurityDigestWorkspace } = await import('./security-digest-workspace')

const DRAFT: IssueRow = {
  id: 'issue-1',
  topic: 'phishing',
  title: 'Spot a fake invoice',
  preheader: 'Three checks.',
  intro: ['A vendor emails a new bank account.'],
  tips: ['Call the vendor on a number you already have.'],
  takeaway: 'Pause before you pay.',
  source: null,
  status: 'draft',
  sendOn: '2026-11-23',
  error: '',
  decidedByName: '',
  decidedAt: null,
  sentAt: null,
  createdAt: '2026-11-19T02:00:00.000Z',
  deliveries: [],
}

function overview(issues: IssueRow[]): DigestOverview {
  return {
    settings: {
      enabled: true,
      recipients: ['me@ihp.test'],
      includeClients: false,
      reportTo: '',
      topics: ['phishing'],
      useAlerts: true,
    },
    clientContacts: 0,
    recipientCount: 2,
    issues,
    canManage: true,
    aiConfigured: true,
    emailConfigured: true,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.getDigestOverview.mockResolvedValue({ ok: true, data: overview([DRAFT]) })
})

describe('SecurityDigestWorkspace', () => {
  it('shows the newest issue as recipients will read it', async () => {
    const { container } = render(<SecurityDigestWorkspace />)

    expect(
      await screen.findByRole('heading', { name: 'Spot a fake invoice', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Call the vendor on a number you already have.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Spot a fake invoice' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('marks the issue approved before the server answers', async () => {
    const user = userEvent.setup()
    let finish: (value: unknown) => void = () => {}
    actions.approveDigestIssue.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    render(<SecurityDigestWorkspace />)

    await user.click(await screen.findByRole('button', { name: /approve for/i }))

    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
    expect(actions.approveDigestIssue).toHaveBeenCalledWith({ issueId: 'issue-1' })
    finish({ ok: true, data: { issueId: 'issue-1' } })
  })

  it('snaps back and announces why when approval fails', async () => {
    const user = userEvent.setup()
    actions.approveDigestIssue.mockResolvedValue({
      ok: false,
      message: 'That issue is no longer waiting for this — refresh the page.',
    })
    render(<SecurityDigestWorkspace />)

    await user.click(await screen.findByRole('button', { name: /approve for/i }))

    await waitFor(() =>
      expect(notify.announceFailure).toHaveBeenCalledWith(
        'That issue is no longer waiting for this — refresh the page.',
      ),
    )
    expect(screen.getAllByText('Needs review').length).toBeGreaterThan(0)
  })

  it('sends a draft straight away once IT confirms who it goes to', async () => {
    const user = userEvent.setup()
    actions.sendDigestIssueNow.mockResolvedValue({ ok: true, data: { sent: 2, failed: 0 } })
    render(<SecurityDigestWorkspace />)

    await user.click(await screen.findByRole('button', { name: 'Send now' }))
    const dialog = await screen.findByRole('dialog', { name: 'Send this issue now?' })
    expect(dialog).toHaveTextContent('also approves it in your name')
    await user.click(screen.getByRole('button', { name: 'Send to 2 people' }))

    expect(actions.sendDigestIssueNow).toHaveBeenCalledWith({ issueId: 'issue-1' })
    await waitFor(() => expect(notify.announceSuccess).toHaveBeenCalledWith('Sent to 2 people.'))
  })

  it('sends nothing when IT keeps the issue scheduled', async () => {
    const user = userEvent.setup()
    render(<SecurityDigestWorkspace />)

    await user.click(await screen.findByRole('button', { name: 'Send now' }))
    await user.click(await screen.findByRole('button', { name: 'Keep it scheduled' }))

    expect(actions.sendDigestIssueNow).not.toHaveBeenCalled()
  })

  it('offers to draft the first issue when there are none', async () => {
    actions.getDigestOverview.mockResolvedValue({ ok: true, data: overview([]) })
    render(<SecurityDigestWorkspace />)

    expect(await screen.findByText('No issues yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draft first issue' })).toBeInTheDocument()
  })

  it('explains a failed load and retries', async () => {
    const user = userEvent.setup()
    actions.getDigestOverview.mockResolvedValueOnce({
      ok: false,
      message: 'This page is only for the IT department.',
    })
    render(<SecurityDigestWorkspace />)

    expect(await screen.findByRole('alert')).toHaveTextContent('only for the IT department')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Spot a fake invoice', level: 2 }),
    ).toBeInTheDocument()
  })

  it('shows what went wrong on a failed draft', async () => {
    actions.getDigestOverview.mockResolvedValue({
      ok: true,
      data: overview([
        { ...DRAFT, title: '', status: 'failed', error: 'The AI could not be reached.' },
      ]),
    })
    render(<SecurityDigestWorkspace />)

    expect(await screen.findByText('The AI could not be reached.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve for/i })).not.toBeInTheDocument()
  })
})
