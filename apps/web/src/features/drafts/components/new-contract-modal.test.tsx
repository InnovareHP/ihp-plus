import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { NewContractModal } from './new-contract-modal'

const actions = vi.hoisted(() => ({ createDraft: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function fileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('no file input')
  return input
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.createDraft.mockResolvedValue({
    ok: true,
    data: { id: 'draft-1', kind: 'contract', title: 'Agreement', updatedAt: '' },
  })
})

describe('NewContractModal', () => {
  it('sends the attached proposal and opens the new draft', async () => {
    const user = userEvent.setup()
    render(<NewContractModal opened onClose={vi.fn()} />)

    await user.upload(fileInput(), new File(['x'], 'Acme proposal.docx', { type: DOCX }))
    await user.click(screen.getByRole('button', { name: 'Start contract' }))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/drafts/draft-1'))
    const sent = actions.createDraft.mock.calls[0]?.[0] as FormData
    expect((sent.get('proposal') as File).name).toBe('Acme proposal.docx')
  })

  it('starts a blank contract when no proposal is attached', async () => {
    const user = userEvent.setup()
    render(<NewContractModal opened onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Start contract' }))

    await waitFor(() => expect(router.push).toHaveBeenCalled())
    expect((actions.createDraft.mock.calls[0]?.[0] as FormData).has('proposal')).toBe(false)
  })

  it('refuses a file that is not a PDF or Word document', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<NewContractModal opened onClose={vi.fn()} />)

    await user.upload(fileInput(), new File(['x'], 'notes.txt', { type: 'text/plain' }))
    await user.click(screen.getByRole('button', { name: 'Start contract' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a PDF or a Word (.docx) file.',
    )
    expect(actions.createDraft).not.toHaveBeenCalled()
  })

  it('shows the server’s reason when the contract cannot be started', async () => {
    const user = userEvent.setup()
    actions.createDraft.mockResolvedValue({
      ok: false,
      message: 'Only admins can draft contracts.',
    })
    render(<NewContractModal opened onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Start contract' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can draft contracts.')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    const { container } = render(<NewContractModal opened onClose={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
