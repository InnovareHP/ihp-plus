import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { render, screen, userEvent, waitFor, within } from '@/test/render'
import { BluebookLibrary } from './bluebook-library'

const actions = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  listBluebookOptions: vi.fn(),
  uploadDocument: vi.fn(),
  updateDocument: vi.fn(),
  archiveDocument: vi.fn(),
  restoreDocument: vi.fn(),
  purgeDocument: vi.fn(),
  documentLink: vi.fn(),
}))

const toast = vi.hoisted(() => ({ show: vi.fn() }))
const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@mantine/notifications', () => ({ notifications: { show: toast.show } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/bluebook',
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const CHECKLIST = {
  id: 'doc-1',
  title: 'Claim scrubbing checklist',
  description: 'Run before submission.',
  category: 'Procedure',
  teamId: 'team-1',
  teamName: 'Revenue Cycle',
  fileName: 'claim.pdf',
  contentType: 'application/pdf',
  byteSize: 2048,
  uploadedByName: 'Grace Hopper',
  createdAt: '2026-05-01T00:00:00.000Z',
  archivedAt: undefined,
  canManage: true,
}

const ONE_PAGE = {
  page: 1,
  pageSize: 25,
  total: 1,
  pageCount: 1,
  hasPrevious: false,
  hasNext: false,
}

const page = (rows: unknown[], pageInfo: Partial<typeof ONE_PAGE> = {}) => ({
  ok: true,
  rows,
  pageInfo: { ...ONE_PAGE, ...pageInfo },
})

const OPTIONS = (patch: Record<string, unknown> = {}) => ({
  ok: true,
  data: {
    shelves: [
      { value: 'company', label: 'All departments', documentCount: 2, canUpload: true },
      { value: 'team-1', label: 'Revenue Cycle', documentCount: 1, canUpload: true },
      { value: 'team-2', label: 'Care Management', documentCount: 0, canUpload: false },
    ],
    categories: ['Policy', 'Procedure'],
    isAdmin: false,
    ...patch,
  },
})

const user = () => userEvent.setup()

// Mantine's FileInput shows a button and keeps the real input hidden, so there is no role or
// label to query it by.
function hiddenFileInput() {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error('no file input rendered')
  return input as HTMLInputElement
}

describe('BluebookLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    actions.listDocuments.mockResolvedValue(page([CHECKLIST]))
    actions.listBluebookOptions.mockResolvedValue(OPTIONS())
    actions.uploadDocument.mockResolvedValue({ ok: true, data: CHECKLIST })
    actions.updateDocument.mockResolvedValue({ ok: true, data: CHECKLIST })
    actions.archiveDocument.mockResolvedValue({ ok: true, data: null })
    actions.restoreDocument.mockResolvedValue({ ok: true, data: null })
    actions.documentLink.mockResolvedValue({ ok: true, data: { url: 'https://files/x' } })
  })

  it('shows a document with the shelf it is filed under and its file size', async () => {
    render(<BluebookLibrary />)

    expect(await screen.findByText('Claim scrubbing checklist')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Bluebook documents' })
    expect(within(table).getByText('Revenue Cycle')).toBeInTheDocument()
    expect(within(table).getByText('Procedure')).toBeInTheDocument()
    expect(within(table).getByText('2.0 KB')).toBeInTheDocument()
    expect(within(table).getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('offers a shelf per department plus the all-departments one, with counts', async () => {
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    const rail = within(screen.getByRole('navigation', { name: 'Bluebook shelves' }))
    expect(rail.getByRole('button', { name: /All departments/ })).toHaveTextContent('2')
    expect(rail.getByRole('button', { name: /Care Management/ })).toBeInTheDocument()
    // Everything is where the page opens, and the rail says so.
    expect(rail.getByRole('button', { name: /Everything/ })).toHaveAttribute('aria-current', 'true')
  })

  it('puts the chosen shelf in the URL rather than filtering in place', async () => {
    const person = user()
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    const rail = within(screen.getByRole('navigation', { name: 'Bluebook shelves' }))
    await person.click(rail.getByRole('button', { name: /Revenue Cycle/ }))

    expect(nav.replace).toHaveBeenCalledWith('/bluebook?shelf=team-1', { scroll: false })
  })

  it('asks the server for the shelf and view the URL carries', async () => {
    nav.search = 'shelf=company&view=archived&categories=Policy'
    render(<BluebookLibrary />)

    await screen.findByText('Claim scrubbing checklist')
    expect(actions.listDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ shelf: 'company', view: 'archived', categories: ['Policy'] }),
    )
  })

  it('uploads a file with the metadata around it', async () => {
    const person = user()
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    await person.click(screen.getByRole('button', { name: 'Upload file' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Upload to the bluebook' }))
    await person.upload(
      hiddenFileInput(),
      new File(['policy'], 'policy.pdf', { type: 'application/pdf' }),
    )
    await person.type(dialog.getByRole('textbox', { name: /Title/ }), 'Time-off policy')
    await person.click(dialog.getByRole('button', { name: 'Add to bluebook' }))

    await waitFor(() => expect(actions.uploadDocument).toHaveBeenCalled())
    const sent = actions.uploadDocument.mock.calls[0]?.[0] as FormData
    expect(sent.get('title')).toBe('Time-off policy')
    expect(sent.get('shelf')).toBe('company')
    expect((sent.get('file') as File).name).toBe('policy.pdf')
  })

  // The accept attribute keeps a .exe out of the picker, and the type rule itself is covered in
  // schema.test.ts and enforced again server-side; what a user can still do is submit with none.
  it('refuses to upload with no file chosen', async () => {
    const person = user()
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    await person.click(screen.getByRole('button', { name: 'Upload file' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Upload to the bluebook' }))
    await person.type(dialog.getByRole('textbox', { name: /Title/ }), 'Time-off policy')
    await person.click(dialog.getByRole('button', { name: 'Add to bluebook' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a file to upload.')
    expect(actions.uploadDocument).not.toHaveBeenCalled()
  })

  it('only offers shelves the person may file on', async () => {
    const person = user()
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    await person.click(screen.getByRole('button', { name: 'Upload file' }))
    await person.click(screen.getByRole('combobox', { name: 'Filed under' }))

    expect(screen.getByRole('option', { name: 'All departments' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Care Management' })).not.toBeInTheDocument()
  })

  it('archives a document immediately and offers undo', async () => {
    let resolve: (value: unknown) => void = () => {}
    actions.archiveDocument.mockReturnValue(
      new Promise((settle) => {
        resolve = settle
      }),
    )
    const person = user()
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    await person.click(
      screen.getByRole('button', { name: 'Actions for Claim scrubbing checklist' }),
    )
    await person.click(screen.getByRole('menuitem', { name: 'Archive' }))

    await waitFor(() =>
      expect(screen.queryByText('Claim scrubbing checklist')).not.toBeInTheDocument(),
    )
    resolve({ ok: true, data: null })
    await waitFor(() => expect(toast.show).toHaveBeenCalled())

    const undo = toast.show.mock.calls.at(-1)?.[0]
    render(undo.message)
    await person.click(screen.getByRole('button', { name: 'Undo' }))
    expect(actions.restoreDocument).toHaveBeenCalledWith({ id: 'doc-1' })
  })

  it('gives a reader the download but no management menu', async () => {
    actions.listDocuments.mockResolvedValue(page([{ ...CHECKLIST, canManage: false }]))
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    expect(
      screen.getByRole('button', { name: 'Open Claim scrubbing checklist' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Actions for Claim scrubbing checklist' }),
    ).not.toBeInTheDocument()
  })

  it('hides upload entirely from someone who leads nothing', async () => {
    actions.listBluebookOptions.mockResolvedValue(
      OPTIONS({
        shelves: [
          { value: 'company', label: 'All departments', documentCount: 2, canUpload: false },
        ],
      }),
    )
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    expect(screen.queryByRole('button', { name: 'Upload file' })).not.toBeInTheDocument()
  })

  it('opens a document through a link minted on the click', async () => {
    const opener = vi.spyOn(window, 'open').mockReturnValue(null)
    const person = user()
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    await person.click(screen.getByRole('button', { name: 'Open Claim scrubbing checklist' }))

    await waitFor(() => expect(actions.documentLink).toHaveBeenCalledWith({ id: 'doc-1' }))
    expect(opener).toHaveBeenCalledWith('https://files/x', '_blank', 'noopener,noreferrer')
    opener.mockRestore()
  })

  it('points an admin at the departments screen to name leads, and hides it otherwise', async () => {
    render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')
    expect(screen.queryByRole('link', { name: /Department leads/ })).not.toBeInTheDocument()

    actions.listBluebookOptions.mockResolvedValue(OPTIONS({ isAdmin: true }))
    render(<BluebookLibrary />)

    const link = await screen.findByRole('link', { name: /Department leads/ })
    // next/link prefixes the basePath in the browser, not in jsdom.
    expect(link).toHaveAttribute('href', '/organization?tab=departments')
  })

  it('explains an empty bluebook and a filtered dead end differently', async () => {
    actions.listDocuments.mockResolvedValue(page([], { total: 0 }))
    render(<BluebookLibrary />)

    expect(await screen.findByText('The bluebook is empty')).toBeInTheDocument()

    nav.search = 'search=nothing'
    render(<BluebookLibrary />)
    expect(await screen.findByText('No documents match these filters')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<BluebookLibrary />)
    await screen.findByText('Claim scrubbing checklist')

    expect(await axe(container)).toHaveNoViolations()
  })
})
