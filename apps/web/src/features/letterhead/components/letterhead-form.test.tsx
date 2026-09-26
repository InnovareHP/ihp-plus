import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor } from '@/test/render'
import { LetterheadForm } from './letterhead-form'

const actions = vi.hoisted(() => ({ applyLetterheadToFile: vi.fn() }))
const download = vi.hoisted(() => ({ downloadFile: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('../utils/download', () => download)

const STAMPED = {
  fileName: 'Policy (letterhead).pdf',
  contentType: 'application/pdf',
  bytes: new Uint8Array([1, 2, 3]),
}

function fileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('no file input')
  return input
}

async function pickPdf(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(fileInput(), new File(['%PDF'], 'Policy.pdf', { type: 'application/pdf' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.applyLetterheadToFile.mockResolvedValue({ ok: true, data: STAMPED })
})

describe('LetterheadForm', () => {
  it('sends the file with the official letterhead by default and downloads the result', async () => {
    const user = userEvent.setup()
    render(<LetterheadForm />)

    await pickPdf(user)
    await user.click(screen.getByRole('button', { name: 'Add letterhead and download' }))

    await waitFor(() => expect(download.downloadFile).toHaveBeenCalledWith(STAMPED))
    const sent = actions.applyLetterheadToFile.mock.calls[0]?.[0] as FormData
    expect(sent.get('template')).toBe('official')
    expect((sent.get('file') as File).name).toBe('Policy.pdf')
    expect(await screen.findByText(/Policy \(letterhead\)\.pdf downloaded/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download it again' }))
    expect(download.downloadFile).toHaveBeenCalledTimes(2)
  })

  it('sends the letterhead that was picked', async () => {
    const user = userEvent.setup()
    render(<LetterheadForm />)

    await pickPdf(user)
    await user.click(screen.getByRole('radio', { name: /Classic/ }))
    await user.click(screen.getByRole('button', { name: 'Add letterhead and download' }))

    await waitFor(() => expect(actions.applyLetterheadToFile).toHaveBeenCalled())
    const sent = actions.applyLetterheadToFile.mock.calls[0]?.[0] as FormData
    expect(sent.get('template')).toBe('classic')
  })

  it('asks for a file before sending anything', async () => {
    const user = userEvent.setup()
    render(<LetterheadForm />)

    await user.click(screen.getByRole('button', { name: 'Add letterhead and download' }))

    expect(await screen.findByText('Choose a file to put the letterhead on.')).toBeInTheDocument()
    expect(actions.applyLetterheadToFile).not.toHaveBeenCalled()
  })

  it('announces a server failure and keeps the chosen file', async () => {
    actions.applyLetterheadToFile.mockResolvedValue({
      ok: false,
      message: 'That PDF is password-protected, so the letterhead cannot be added.',
    })
    const user = userEvent.setup()
    render(<LetterheadForm />)

    await pickPdf(user)
    await user.click(screen.getByRole('button', { name: 'Add letterhead and download' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('password-protected')
    expect(download.downloadFile).not.toHaveBeenCalled()
    expect(screen.getByText('Policy.pdf')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<LetterheadForm />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
