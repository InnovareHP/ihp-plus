import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTRACT_TEMPLATE, contractGreeting } from './utils/templates'

const prisma = vi.hoisted(() => ({
  draft: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
const guard = vi.hoisted(() => ({
  requireOnboarded: vi.fn(async () => ({ user: { id: 'user-1' }, profile: {} })),
  membershipOf: vi.fn(() => ({ organizationId: 'org-1' })),
  canManageOrganization: vi.fn(() => true),
}))
const ai = vi.hoisted(() => ({
  draftTurn: vi.fn(),
  DraftAiError: class extends Error {},
}))

vi.mock('@ihp/db', () => ({ db: prisma }))
vi.mock('@/lib/auth-guard', () => guard)
vi.mock('./ai', () => ai)

const { createDraft, sendDraftMessage, undoDraftChange } = await import('./actions')

const BODY = CONTRACT_TEMPLATE.body
const UPDATED_AT = new Date('2026-10-21T10:00:00Z')

function stored(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    kind: 'contract',
    title: 'Services agreement',
    body: BODY,
    previousBody: null,
    messages: [{ role: 'assistant', content: 'Who is the client?' }],
    proposalName: null,
    proposalFormat: null,
    proposal: null,
    updatedAt: UPDATED_AT,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  guard.canManageOrganization.mockReturnValue(true)
  prisma.draft.findFirst.mockResolvedValue(stored())
  prisma.draft.update.mockImplementation(async ({ data }) => stored(data))
})

function formWith(file?: File) {
  const form = new FormData()
  if (file) form.set('proposal', file)
  return form
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

describe('createDraft', () => {
  beforeEach(() => {
    prisma.draft.create.mockImplementation(async ({ data }) => stored(data))
  })

  it('starts a blank contract from the template with the greeting as the first message', async () => {
    const result = await createDraft(formWith())

    expect(result).toMatchObject({ ok: true, data: { kind: 'contract' } })
    const data = prisma.draft.create.mock.calls[0]?.[0].data
    expect(data).toMatchObject({
      organizationId: 'org-1',
      createdById: 'user-1',
      body: BODY,
      messages: [{ role: 'assistant', content: contractGreeting(null) }],
    })
    expect(data).not.toHaveProperty('proposal')
  })

  it('keeps an attached proposal with the draft and names it in the greeting', async () => {
    const proposal = new File(['proposal text'], 'Acme proposal.docx', { type: DOCX })

    expect(await createDraft(formWith(proposal))).toMatchObject({ ok: true })

    const data = prisma.draft.create.mock.calls[0]?.[0].data
    expect(data).toMatchObject({
      proposalName: 'Acme proposal.docx',
      proposalFormat: 'docx',
      messages: [{ role: 'assistant', content: contractGreeting('Acme proposal.docx') }],
    })
    expect(new TextDecoder().decode(data.proposal)).toBe('proposal text')
  })

  it('refuses a proposal that is not a PDF or Word file', async () => {
    const text = new File(['hi'], 'notes.txt', { type: 'text/plain' })

    expect(await createDraft(formWith(text))).toEqual({
      ok: false,
      message: 'Choose a PDF or a Word (.docx) file.',
    })
    expect(prisma.draft.create).not.toHaveBeenCalled()
  })

  it('is closed to anyone who cannot manage the organization', async () => {
    guard.canManageOrganization.mockReturnValue(false)
    expect(await createDraft(formWith())).toEqual({
      ok: false,
      message: 'Only admins can draft contracts.',
    })
    expect(prisma.draft.create).not.toHaveBeenCalled()
  })
})

describe('sendDraftMessage', () => {
  it('saves the new document, keeps the old one for undo and appends both turns', async () => {
    const document = BODY.replace('{{client_legal_name}}', 'Acme Corp')
    ai.draftTurn.mockImplementation(async ({ document: visible }) => ({
      reply: 'Added Acme.',
      title: 'Agreement — Acme',
      document: visible.replace('{{client_legal_name}}', 'Acme Corp'),
    }))

    const result = await sendDraftMessage('draft-1', '  The client is Acme Corp ')

    if (!result.ok) throw new Error(result.message)
    expect(result.data).toMatchObject({ body: document, canUndo: true, title: 'Agreement — Acme' })
    // The AI only ever sees tokens for the locked sections.
    expect(ai.draftTurn.mock.calls[0]?.[0].document).not.toContain('It survives for 2 years')
    expect(prisma.draft.findFirst).toHaveBeenCalledWith({
      where: { id: 'draft-1', organizationId: 'org-1' },
    })
    expect(prisma.draft.update.mock.calls[0]?.[0].data).toEqual({
      title: 'Agreement — Acme',
      body: document,
      previousBody: BODY,
      messages: [
        { role: 'assistant', content: 'Who is the client?' },
        { role: 'user', content: 'The client is Acme Corp' },
        { role: 'assistant', content: 'Added Acme.' },
      ],
    })
  })

  it('sends the stored proposal to the AI on every turn', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    prisma.draft.findFirst.mockResolvedValue(
      stored({ proposalName: 'p.pdf', proposalFormat: 'pdf', proposal: bytes }),
    )
    ai.draftTurn.mockImplementation(async ({ document: visible }) => ({
      reply: 'Drafted.',
      title: 'Agreement',
      document: visible,
    }))

    expect(await sendDraftMessage('draft-1', 'Draft it')).toMatchObject({ ok: true })
    expect(ai.draftTurn.mock.calls[0]?.[0].proposal).toEqual({ format: 'pdf', bytes })
  })

  it('saves nothing when the AI dropped a locked section', async () => {
    ai.draftTurn.mockImplementation(async ({ document: visible }) => ({
      reply: 'Done.',
      title: 'Agreement',
      document: visible.replace('[locked section 3]', ''),
    }))

    const result = await sendDraftMessage('draft-1', 'Shorten confidentiality to a year')

    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('locked') })
    expect(prisma.draft.update).not.toHaveBeenCalled()
  })

  it('reports an AI failure, an empty message and a draft from another organization', async () => {
    ai.draftTurn.mockRejectedValueOnce(new ai.DraftAiError('The AI could not be reached.'))
    expect(await sendDraftMessage('draft-1', 'Hi')).toEqual({
      ok: false,
      message: 'The AI could not be reached.',
    })

    expect(await sendDraftMessage('draft-1', '   ')).toMatchObject({ ok: false })

    prisma.draft.findFirst.mockResolvedValueOnce(null)
    expect(await sendDraftMessage('other', 'Hi')).toEqual({
      ok: false,
      message: 'That draft no longer exists.',
    })
    expect(prisma.draft.update).not.toHaveBeenCalled()
  })
})

describe('undoDraftChange', () => {
  it('puts the previous document back once', async () => {
    prisma.draft.findFirst.mockResolvedValueOnce(stored({ body: 'new', previousBody: BODY }))

    const result = await undoDraftChange('draft-1')

    expect(result).toMatchObject({ ok: true, data: { body: BODY, canUndo: false } })
    expect(prisma.draft.update.mock.calls[0]?.[0].data).toMatchObject({
      body: BODY,
      previousBody: null,
    })
    expect(await undoDraftChange('draft-1')).toEqual({
      ok: false,
      message: 'There is no change to undo.',
    })
  })
})
