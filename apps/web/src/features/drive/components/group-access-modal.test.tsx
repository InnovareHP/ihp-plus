import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, waitFor } from '@/test/render'

const actions = vi.hoisted(() => ({
  listGroupAccess: vi.fn(),
  shareGroupFolder: vi.fn(),
  revokeClientFolderAccess: vi.fn(),
}))

const announce = vi.hoisted(() => ({ announceFailure: vi.fn(), announceSuccess: vi.fn() }))

vi.mock('../actions', () => actions)
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('@/lib/announce', () => announce)

const { GroupAccessModal } = await import('./group-access-modal')

const GROUP = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Smith Holdings',
  webUrl: undefined,
  activeGrants: 1,
  members: [
    { id: 'c1', name: 'Acme Dental' },
    { id: 'c2', name: 'Acme Ortho' },
  ],
}

const GUEST = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'owner@smith.test',
  role: 'read',
  invitedAt: '2026-03-04T10:00:00.000Z',
  revokedAt: undefined,
}

function open() {
  return render(<GroupAccessModal opened onClose={vi.fn()} group={GROUP} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.listGroupAccess.mockResolvedValue({ ok: true, data: [] })
  actions.revokeClientFolderAccess.mockResolvedValue({
    ok: true,
    data: { ...GUEST, revokedAt: '2026-03-05T10:00:00.000Z' },
  })
})

describe('GroupAccessModal', () => {
  it('names every company one link opens', async () => {
    open()

    expect(await screen.findByText(/One link opens Acme Dental and Acme Ortho/)).toBeInTheDocument()
  })

  it('shows the owner before the server answers', async () => {
    const user = userEvent.setup()
    let resolveShare: (value: unknown) => void = () => {}
    actions.shareGroupFolder.mockReturnValue(
      new Promise((resolve) => {
        resolveShare = resolve
      }),
    )
    open()

    await user.type(await screen.findByLabelText(/Email address/), 'owner@smith.test')
    await user.click(screen.getByRole('button', { name: 'Share folder' }))

    expect(await screen.findByText('owner@smith.test')).toBeInTheDocument()
    expect(actions.shareGroupFolder).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: GROUP.id, email: 'owner@smith.test' }),
    )
    resolveShare({ ok: true, data: GUEST })
  })

  it('takes the row back out and announces it when the share is refused', async () => {
    const user = userEvent.setup()
    actions.shareGroupFolder.mockResolvedValue({
      ok: false,
      message: 'Microsoft refused that address — External sharing is off for this site.',
    })
    open()

    await user.type(await screen.findByLabelText(/Email address/), 'owner@smith.test')
    await user.click(screen.getByRole('button', { name: 'Share folder' }))

    await waitFor(() =>
      expect(announce.announceFailure).toHaveBeenCalledWith(
        'Microsoft refused that address — External sharing is off for this site.',
      ),
    )
    expect(
      await screen.findByText('Nobody outside the company can open this folder'),
    ).toBeInTheDocument()
  })

  it('removes access from the group folder', async () => {
    const user = userEvent.setup()
    actions.listGroupAccess.mockResolvedValueOnce({ ok: true, data: [GUEST] })
    actions.listGroupAccess.mockResolvedValue({
      ok: true,
      data: [{ ...GUEST, revokedAt: '2026-03-05T10:00:00.000Z' }],
    })
    open()

    await user.click(await screen.findByRole('button', { name: 'Remove access' }))

    expect(actions.revokeClientFolderAccess).toHaveBeenCalledWith(GUEST.id)
    expect(await screen.findByText('Removed')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    actions.listGroupAccess.mockResolvedValue({ ok: true, data: [GUEST] })
    const { baseElement } = open()

    await screen.findByText('owner@smith.test')

    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
