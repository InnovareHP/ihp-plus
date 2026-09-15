import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/render'

const actions = vi.hoisted(() => ({
  listClientAccess: vi.fn(),
  shareClientFolder: vi.fn(),
  revokeClientFolderAccess: vi.fn(),
}))

const announce = vi.hoisted(() => ({ announceFailure: vi.fn(), announceSuccess: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/announce', () => announce)

const { ClientAccessModal } = await import('./client-access-modal')

const CLIENT = { id: '11111111-1111-4111-8111-111111111111', name: 'Acme' }

const GUEST = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'buyer@acme.test',
  role: 'read',
  invitedAt: '2026-03-04T10:00:00.000Z',
  revokedAt: undefined,
}

function open() {
  return render(<ClientAccessModal opened onClose={vi.fn()} client={CLIENT} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.listClientAccess.mockResolvedValue({ ok: true, data: [] })
  actions.shareClientFolder.mockResolvedValue({
    ok: true,
    data: { ...GUEST, email: 'dana@acme.test' },
  })
  actions.revokeClientFolderAccess.mockResolvedValue({
    ok: true,
    data: { ...GUEST, revokedAt: '2026-03-05T10:00:00.000Z' },
  })
})

describe('ClientAccessModal', () => {
  it('says what the folder holds and who can open it', async () => {
    actions.listClientAccess.mockResolvedValue({ ok: true, data: [GUEST] })
    open()

    expect(await screen.findByText('buyer@acme.test')).toBeInTheDocument()
    expect(screen.getByText(/Can read since/)).toBeInTheDocument()
  })

  it('offers the way to fill it when nobody has access yet', async () => {
    open()

    expect(
      await screen.findByText('Nobody outside the company can open this folder'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share folder' })).toBeInTheDocument()
  })

  it('shows the new person before the server answers', async () => {
    const user = userEvent.setup()
    let resolveShare: (value: unknown) => void = () => {}
    actions.shareClientFolder.mockReturnValue(
      new Promise((resolve) => {
        resolveShare = resolve
      }),
    )
    open()

    await user.type(await screen.findByLabelText(/Email address/), 'dana@acme.test')
    await user.click(screen.getByRole('button', { name: 'Share folder' }))

    expect(await screen.findByText('dana@acme.test')).toBeInTheDocument()
    resolveShare({ ok: true, data: { ...GUEST, email: 'dana@acme.test' } })
  })

  it('takes the row back out and announces it when the share is refused', async () => {
    const user = userEvent.setup()
    actions.shareClientFolder.mockResolvedValue({
      ok: false,
      message: 'Microsoft refused that address — External sharing is off for this site.',
    })
    open()

    await user.type(await screen.findByLabelText(/Email address/), 'dana@acme.test')
    await user.click(screen.getByRole('button', { name: 'Share folder' }))

    await waitFor(() => expect(screen.queryByText('dana@acme.test')).not.toBeInTheDocument())
    expect(announce.announceFailure).toHaveBeenCalledWith(
      'Microsoft refused that address — External sharing is off for this site.',
    )
  })

  it('keeps what was typed when the address is not an email', async () => {
    const user = userEvent.setup()
    open()

    const email = await screen.findByLabelText(/Email address/)
    await user.type(email, 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Share folder' }))

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
    expect(email).toHaveValue('not-an-email')
    expect(actions.shareClientFolder).not.toHaveBeenCalled()
  })

  it('removes access immediately rather than asking to confirm', async () => {
    const user = userEvent.setup()
    actions.listClientAccess.mockResolvedValueOnce({ ok: true, data: [GUEST] })
    // What the refetch after the revoke reads back.
    actions.listClientAccess.mockResolvedValue({
      ok: true,
      data: [{ ...GUEST, revokedAt: '2026-03-05T10:00:00.000Z' }],
    })
    open()

    await user.click(await screen.findByRole('button', { name: 'Remove access' }))

    expect(await screen.findByText('Removed')).toBeInTheDocument()
    expect(actions.revokeClientFolderAccess).toHaveBeenCalledWith(GUEST.id)
  })

  it('puts access back and announces it when the revoke fails', async () => {
    const user = userEvent.setup()
    actions.listClientAccess.mockResolvedValue({ ok: true, data: [GUEST] })
    actions.revokeClientFolderAccess.mockResolvedValue({
      ok: false,
      message: 'Could not remove that access — try again.',
    })
    open()

    await user.click(await screen.findByRole('button', { name: 'Remove access' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove access' })).toBeInTheDocument(),
    )
    expect(announce.announceFailure).toHaveBeenCalledWith(
      'Could not remove that access — try again.',
    )
  })

  it('offers a retry when the list cannot be read', async () => {
    actions.listClientAccess.mockResolvedValue({ ok: false, message: 'Graph is unreachable.' })
    open()

    expect(await screen.findByRole('alert')).toHaveTextContent('Graph is unreachable.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('reaches share and remove with the keyboard alone', async () => {
    const user = userEvent.setup()
    actions.listClientAccess.mockResolvedValue({ ok: true, data: [GUEST] })
    open()

    await screen.findByText('buyer@acme.test')

    // The modal opens with the first field focused, so the walk starts there.
    expect(screen.getByLabelText(/Email address/)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/^Name/)).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Share folder' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Remove access' })).toHaveFocus()
  })

  it('has no axe violations', async () => {
    actions.listClientAccess.mockResolvedValue({ ok: true, data: [GUEST] })
    const { container } = open()

    await screen.findByText('buyer@acme.test')

    expect(await axe(container)).toHaveNoViolations()
  })
})
