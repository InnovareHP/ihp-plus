import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, within } from '@/test/render'
import type { DraftDetail } from '../schema'
import { DraftWorkspace } from './draft-workspace'

const actions = vi.hoisted(() => ({
  getDraft: vi.fn(),
  listDrafts: vi.fn(),
  createDraft: vi.fn(),
  sendDraftMessage: vi.fn(),
  undoDraftChange: vi.fn(),
}))

vi.mock('../actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const DRAFT: DraftDetail = {
  id: 'draft-1',
  kind: 'contract',
  title: 'Services agreement',
  updatedAt: '2026-10-21T10:00:00.000Z',
  proposalName: null,
  body: '# Services agreement\n\nBetween Innovare HP and {{client_name}}. Fee: {{fee_amount}}.\n\n[locked]\n## Confidentiality\n\nKeep it private.\n[/locked]',
  canUndo: false,
  messages: [{ role: 'assistant', content: 'Who is the client?' }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.getDraft.mockResolvedValue({ ok: true, data: DRAFT })
})

describe('DraftWorkspace', () => {
  it('shows the message at once, then the reply and the filled-in document', async () => {
    const user = userEvent.setup()
    const pending = deferred<{ ok: true; data: DraftDetail }>()
    actions.sendDraftMessage.mockReturnValue(pending.promise)
    render(<DraftWorkspace initialDraft={DRAFT} />)

    expect(screen.getByText('1 detail still missing')).toBeInTheDocument()
    expect(screen.getByText('Locked wording')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Message'), 'The client is Acme Corp{Enter}')

    const log = screen.getByRole('list', { name: 'Conversation' })
    expect(within(log).getByText('The client is Acme Corp')).toBeInTheDocument()
    expect(within(log).getByText('Drafting the changes…')).toBeInTheDocument()
    expect(actions.sendDraftMessage).toHaveBeenCalledWith('draft-1', 'The client is Acme Corp')

    const filled = {
      ...DRAFT,
      body: DRAFT.body.replace('{{client_name}}', 'Acme Corp').replace('{{fee_amount}}', '$5,000'),
      canUndo: true,
      messages: [
        ...DRAFT.messages,
        { role: 'user' as const, content: 'The client is Acme Corp' },
        { role: 'assistant' as const, content: 'Added Acme Corp as the client.' },
      ],
    }
    actions.getDraft.mockResolvedValue({ ok: true, data: filled })
    pending.resolve({ ok: true, data: filled })

    expect(await within(log).findByText('Added Acme Corp as the client.')).toBeInTheDocument()
    expect(screen.getByText('Between Innovare HP and Acme Corp. Fee: $5,000.')).toBeInTheDocument()
    expect(screen.queryByText(/still missing/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo last change' })).toBeEnabled()
  })

  it('rolls the message back into the box and announces why when the turn fails', async () => {
    const user = userEvent.setup()
    actions.sendDraftMessage.mockResolvedValue({
      ok: false,
      message: 'The AI could not be reached — try again in a moment.',
    })
    render(<DraftWorkspace initialDraft={DRAFT} />)

    await user.type(screen.getByLabelText('Message'), 'Acme Corp')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The AI could not be reached')
    expect(screen.getByLabelText('Message')).toHaveValue('Acme Corp')
    const log = screen.getByRole('list', { name: 'Conversation' })
    expect(within(log).queryByText('Acme Corp')).not.toBeInTheDocument()
  })

  it('asks for a message instead of sending an empty one', async () => {
    const user = userEvent.setup()
    render(<DraftWorkspace initialDraft={DRAFT} />)

    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Type what to fill in or change.')
    expect(actions.sendDraftMessage).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = render(<DraftWorkspace initialDraft={DRAFT} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
